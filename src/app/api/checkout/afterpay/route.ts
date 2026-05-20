import Stripe from "stripe";
import {
  calculateCatalogOrderAmount,
  resolveCatalogProduct,
  validateCoupon,
} from "@/lib/catalog/resolve";
import { resolveSeller } from "@/lib/catalog/sellers";
import type { CatalogSelection } from "@/lib/catalog/types";
import { getStripeEnv } from "@/lib/env";
import {
  assertAfterpayEligible,
  AfterpayEligibilityError,
} from "@/lib/payments/afterpay";
import { getStripeErrorFailureDetails } from "@/lib/payments/failures";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface AddressPayload {
  country?: unknown;
  postalCode?: unknown;
  state?: unknown;
  city?: unknown;
  line1?: unknown;
  line2?: unknown;
}

interface CreateAfterpayOrderPayload {
  leadId?: unknown;
  quantity?: unknown;
  couponCode?: unknown;
  cpfCnpj?: unknown;
  turmaId?: unknown;
  productId?: unknown;
  sellerId?: unknown;
  sellerSlug?: unknown;
  confirmationTokenId?: unknown;
  returnUrl?: unknown;
  buyerCountry?: unknown;
  billingAddress?: unknown;
}

interface NormalizedAddress {
  country: string;
  postalCode: string;
  state: string;
  city: string;
  line1: string;
  line2: string | null;
}

const FORBIDDEN_CLIENT_PRICING_FIELDS = [
  "amount",
  "amountCents",
  "unitAmount",
  "unitAmountCents",
  "subtotalAmount",
  "subtotalAmountCents",
  "discountAmount",
  "discountAmountCents",
  "totalAmount",
  "totalAmountCents",
  "price",
  "currency",
  "pricing",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STRIPE_ACCOUNT_COUNTRY =
  process.env.STRIPE_ACCOUNT_COUNTRY?.trim().toUpperCase() || "US";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStripeSetupError(error: unknown) {
  const record = asRecord(error);
  if (!record) return null;

  const message = optionalString(record.message);
  const code = optionalString(record.code);
  const type = optionalString(record.type);

  if (!message) return null;

  return {
    message,
    code,
    status:
      type === "StripeInvalidRequestError" || type === "invalid_request_error"
        ? 400
        : 502,
  };
}

function normalizeOptionalCode(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase()
    : null;
}

function hasClientPricingOverride(payload: Record<string, unknown>) {
  return FORBIDDEN_CLIENT_PRICING_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );
}

function appendOrderIdToReturnUrl(returnUrl: string, orderId: string) {
  const url = new URL(returnUrl);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

function normalizeAddress(value: unknown): NormalizedAddress | null {
  const record = value as AddressPayload;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const country =
    typeof record.country === "string" ? record.country.trim().toUpperCase() : "";
  const postalCode =
    typeof record.postalCode === "string" ? record.postalCode.trim() : "";
  const state = typeof record.state === "string" ? record.state.trim().toUpperCase() : "";
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const line1 = typeof record.line1 === "string" ? record.line1.trim() : "";
  const line2 =
    typeof record.line2 === "string" && record.line2.trim()
      ? record.line2.trim()
      : null;

  if (!country || !postalCode || !state || !city || !line1) {
    return null;
  }

  return { country, postalCode, state, city, line1, line2 };
}

function isValidUsBillingAddress(
  address: NormalizedAddress | null
): address is NormalizedAddress {
  return Boolean(
    address &&
      address.country === "US" &&
      address.postalCode.length >= 5 &&
      address.state.length >= 2 &&
      address.city.length >= 2 &&
      address.line1.length >= 3
  );
}

function getAfterpayEligibilityMessage(error: AfterpayEligibilityError) {
  switch (error.result.reason) {
    case "amount_too_large":
      return "Afterpay indisponível para este valor. Reduza a quantidade ou escolha outro método.";
    case "amount_too_small":
      return "Afterpay indisponível para este valor.";
    case "domestic_only":
      return "Afterpay exige comprador no mesmo país da conta Stripe.";
    case "unsupported_currency":
      return "Afterpay indisponível para a moeda deste produto.";
    case "unsupported_country":
      return "Afterpay indisponível para o país da conta Stripe.";
    default:
      return "Afterpay indisponível para este pedido.";
  }
}

export async function POST(request: Request) {
  let payload: CreateAfterpayOrderPayload;

  try {
    payload = (await request.json()) as CreateAfterpayOrderPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  if (hasClientPricingOverride(payload as Record<string, unknown>)) {
    console.warn("Rejected Afterpay checkout payload with client-side pricing fields");
    return jsonError("Preço inválido. O valor do pedido vem do catálogo.", 400);
  }

  const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
  const quantity = Number(payload.quantity);
  const rawCpfCnpj =
    typeof payload.cpfCnpj === "string" ? payload.cpfCnpj.replace(/\D/g, "") : "";
  const cpfCnpj = rawCpfCnpj.length > 0 ? rawCpfCnpj : null;
  const couponCode = normalizeOptionalCode(payload.couponCode);
  const turmaId = typeof payload.turmaId === "string" ? payload.turmaId.trim() : null;
  const productId = typeof payload.productId === "string" ? payload.productId.trim() : null;
  const sellerIdInput =
    typeof payload.sellerId === "string" ? payload.sellerId.trim() : null;
  const sellerSlugInput =
    typeof payload.sellerSlug === "string" ? payload.sellerSlug.trim() : null;
  const confirmationTokenId =
    typeof payload.confirmationTokenId === "string"
      ? payload.confirmationTokenId.trim()
      : null;
  const returnUrl =
    typeof payload.returnUrl === "string" ? payload.returnUrl.trim() : null;
  const buyerCountry =
    typeof payload.buyerCountry === "string"
      ? payload.buyerCountry.trim().toUpperCase()
      : "";
  const billingAddress = normalizeAddress(payload.billingAddress);

  if (!UUID_RE.test(leadId)) {
    return jsonError("Lead inválido.", 400);
  }

  if (cpfCnpj && (cpfCnpj.length < 11 || cpfCnpj.length > 14)) {
    return jsonError("CPF/CNPJ inválido.", 400);
  }

  if (!turmaId || !productId) {
    return jsonError(
      "Turma e produto são obrigatórios para calcular o preço pelo admin.",
      400
    );
  }

  if (!confirmationTokenId) {
    return jsonError("Dados de pagamento Afterpay ausentes.", 400);
  }

  if (!returnUrl) {
    return jsonError("URL de retorno é obrigatória para Afterpay.", 400);
  }

  if (!buyerCountry || !isValidUsBillingAddress(billingAddress)) {
    return jsonError("Endereço de cobrança US válido é obrigatório para Afterpay.", 400);
  }

  if (buyerCountry !== billingAddress?.country) {
    return jsonError("País do comprador deve corresponder ao endereço de cobrança.", 400);
  }

  let effectiveReturnUrl: string;
  try {
    effectiveReturnUrl = new URL(returnUrl).toString();
  } catch {
    return jsonError("URL de retorno inválida.", 400);
  }

  const supabase = getSupabaseAdmin();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, email, name, phone")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    console.error("Failed to lookup lead for Afterpay order", leadError);
    return jsonError("Não foi possível iniciar o pagamento agora.", 500);
  }

  if (!lead) {
    return jsonError("Lead não encontrado.", 404);
  }

  const selection: CatalogSelection = { turmaId, productId };

  let resolved;
  try {
    resolved = await resolveCatalogProduct(selection);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Produto não disponível.",
      404
    );
  }

  if (!resolved.product.paymentMethods.includes("afterpay_clearpay")) {
    return jsonError("Afterpay indisponível para este produto.", 400);
  }

  const sellerRecord = sellerIdInput || sellerSlugInput
    ? await resolveSeller({
        sellerId: sellerIdInput,
        sellerSlug: sellerSlugInput,
        turmaId: resolved.turma.id,
        productId: resolved.product.id,
      })
    : null;

  let appliedCoupon = null;
  if (couponCode) {
    const subtotalCents = resolved.product.unitAmountCents * quantity;
    appliedCoupon = await validateCoupon({
      couponCode,
      turmaId: resolved.turma.id,
      productId: resolved.product.id,
      subtotalCents,
    });
  }

  let pricing;
  try {
    pricing = calculateCatalogOrderAmount({
      product: resolved.product,
      quantity,
      installmentCount: 1,
      coupon: appliedCoupon,
    });
    assertAfterpayEligible({
      amountCents: pricing.totalAmountCents,
      currency: pricing.currency,
      buyerCountry,
      stripeAccountCountry: STRIPE_ACCOUNT_COUNTRY,
    });
  } catch (err) {
    if (err instanceof AfterpayEligibilityError) {
      return jsonError(getAfterpayEligibilityMessage(err), 400);
    }
    return jsonError(
      err instanceof Error ? err.message : "Pedido inválido.",
      400
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      lead_id: lead.id,
      status: "pending_payment",
      payment_method: "afterpay_clearpay",
      quantity: pricing.quantity,
      installment_count: 1,
      unit_amount_cents: pricing.unitAmountCents,
      subtotal_amount_cents: pricing.subtotalAmountCents,
      discount_amount_cents: pricing.discountAmountCents,
      total_amount_cents: pricing.totalAmountCents,
      currency: pricing.currency,
      coupon_code: couponCode,
      cpf_cnpj: cpfCnpj,
      turma_id: resolved.turma.id,
      product_id: resolved.product.id,
      coupon_id: appliedCoupon?.id ?? null,
      seller_record_id: sellerRecord?.id ?? null,
      turma_name: resolved.turma.name,
      turma_slug: resolved.turma.slug,
      product_name: resolved.product.name,
      product_slug: resolved.product.slug,
      product_description: resolved.product.description,
      coupon_code_snapshot: appliedCoupon?.code ?? null,
      coupon_name: appliedCoupon?.name ?? null,
      seller_id_snapshot: sellerRecord?.sellerId ?? null,
      seller_slug_snapshot: sellerRecord?.slug ?? null,
      seller_name_snapshot: sellerRecord?.name ?? null,
    })
    .select("id")
    .single();

  if (orderError) {
    console.error("Failed to create order (afterpay)", orderError);
    return jsonError("Não foi possível criar o pedido agora.", 500);
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.created",
      aggregateType: "order",
      aggregateId: order.id,
      payload: { source: "afterpay_clearpay" },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive Afterpay order sync", err);
  }

  try {
    const stripe = new Stripe(getStripeEnv().stripeSecretKey);
    const metadata: Record<string, string> = {
      orderId: order.id,
      leadId: lead.id,
      installmentCount: "1",
      turmaId: resolved.turma.id,
      productId: resolved.product.id,
      priceSource: "admin_catalog",
      paymentMethod: "afterpay_clearpay",
    };
    if (couponCode) metadata.couponCode = couponCode;
    if (sellerRecord?.sellerId) metadata.sellerId = sellerRecord.sellerId;
    if (sellerRecord?.slug) metadata.sellerSlug = sellerRecord.slug;
    if (sellerRecord?.name) metadata.sellerName = sellerRecord.name;

    effectiveReturnUrl = appendOrderIdToReturnUrl(effectiveReturnUrl, order.id);

    const customerEmail = typeof lead.email === "string" ? lead.email : undefined;
    const customerName =
      typeof lead.name === "string" && lead.name.trim()
        ? lead.name.trim()
        : "Destiny attendee";
    const customerPhone =
      typeof lead.phone === "string" && lead.phone.trim()
        ? lead.phone.trim()
        : undefined;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricing.totalAmountCents,
      currency: pricing.currency,
      confirm: true,
      confirmation_token: confirmationTokenId,
      return_url: effectiveReturnUrl,
      receipt_email: customerEmail,
      metadata,
      payment_method_types: ["afterpay_clearpay"],
      shipping: {
        name: customerName,
        phone: customerPhone,
        address: {
          country: billingAddress.country,
          postal_code: billingAddress.postalCode,
          state: billingAddress.state,
          city: billingAddress.city,
          line1: billingAddress.line1,
          line2: billingAddress.line2 ?? undefined,
        },
      },
      amount_details: {
        discount_amount:
          pricing.discountAmountCents > 0 ? pricing.discountAmountCents : undefined,
        line_items: [
          {
            product_name: resolved.product.name,
            product_code: resolved.product.slug.slice(0, 12),
            quantity: pricing.quantity,
            unit_cost: pricing.unitAmountCents,
          },
        ],
      },
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", order.id);

    if (updateError) {
      console.error("Failed to attach Afterpay payment intent to order", updateError);
      return jsonError("Não foi possível preparar o pagamento agora.", 500);
    }

    return Response.json({
      orderId: order.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("Failed to create Stripe Afterpay PaymentIntent", err);
    const failure = getStripeErrorFailureDetails(err);

    if (failure) {
      const updateValues: Record<string, unknown> = {
        status: "payment_failed",
        paid_at: null,
        stripe_decline_code: failure.stripeDeclineCode,
        stripe_failure_code: failure.stripeFailureCode,
      };

      if (failure.paymentIntentId) {
        updateValues.stripe_payment_intent_id = failure.paymentIntentId;
      }

      const { error: failureUpdateError } = await supabase
        .from("orders")
        .update(updateValues)
        .eq("id", order.id);

      if (failureUpdateError) {
        console.error("Failed to persist Afterpay payment failure", failureUpdateError);
      }

      return Response.json(
        {
          error: failure.normalizedReason,
          orderId: order.id,
          status: "payment_failed",
          stripeDeclineCode: failure.stripeDeclineCode,
          stripeFailureCode: failure.stripeFailureCode,
        },
        { status: 402 }
      );
    }

    const setupError = getStripeSetupError(err);
    if (setupError) {
      return Response.json(
        {
          error: setupError.message,
          orderId: order.id,
          stripeCode: setupError.code,
        },
        { status: setupError.status }
      );
    }

    return jsonError(
      "Afterpay indisponível no momento. Verifique a configuração na Stripe.",
      502
    );
  }
}
