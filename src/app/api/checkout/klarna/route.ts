import Stripe from "stripe";
import {
  calculateCatalogOrderAmount,
  resolveCatalogProduct,
  validateCoupon,
} from "@/lib/catalog/resolve";
import { resolveSeller } from "@/lib/catalog/sellers";
import type { CatalogSelection } from "@/lib/catalog/types";
import { getStripeEnv } from "@/lib/env";
import { getStripeErrorFailureDetails } from "@/lib/payments/failures";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface CreateKlarnaOrderPayload {
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

export async function POST(request: Request) {
  let payload: CreateKlarnaOrderPayload;

  try {
    payload = (await request.json()) as CreateKlarnaOrderPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  if (hasClientPricingOverride(payload as Record<string, unknown>)) {
    console.warn("Rejected Klarna checkout payload with client-side pricing fields");
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
    return jsonError("Dados de pagamento Klarna ausentes.", 400);
  }

  if (!returnUrl) {
    return jsonError("URL de retorno é obrigatória para Klarna.", 400);
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
    console.error("Failed to lookup lead for Klarna order", leadError);
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

  if (!resolved.product.paymentMethods.includes("klarna")) {
    return jsonError("Klarna indisponível para este produto.", 400);
  }

  if (!resolved.product.installmentOptions.some((installment) => installment > 1)) {
    return jsonError("Klarna está disponível apenas para parcelamento.", 400);
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
  } catch (err) {
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
      payment_method: "klarna",
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
    console.error("Failed to create order (klarna)", orderError);
    return jsonError("Não foi possível criar o pedido agora.", 500);
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.created",
      aggregateType: "order",
      aggregateId: order.id,
      payload: { source: "klarna" },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive Klarna order sync", err);
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
      paymentMethod: "klarna",
    };
    if (couponCode) metadata.couponCode = couponCode;
    if (sellerRecord?.sellerId) metadata.sellerId = sellerRecord.sellerId;
    if (sellerRecord?.slug) metadata.sellerSlug = sellerRecord.slug;
    if (sellerRecord?.name) metadata.sellerName = sellerRecord.name;

    effectiveReturnUrl = appendOrderIdToReturnUrl(effectiveReturnUrl, order.id);

    const customerEmail = typeof lead.email === "string" ? lead.email : undefined;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricing.totalAmountCents,
      currency: pricing.currency,
      confirm: true,
      confirmation_token: confirmationTokenId,
      return_url: effectiveReturnUrl,
      receipt_email: customerEmail,
      metadata,
      payment_method_types: ["klarna"],
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
      console.error("Failed to attach Klarna payment intent to order", updateError);
      return jsonError("Não foi possível preparar o pagamento agora.", 500);
    }

    return Response.json({
      orderId: order.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("Failed to create Stripe Klarna PaymentIntent", err);
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
        console.error("Failed to persist Klarna payment failure", failureUpdateError);
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
      "Klarna indisponível no momento. Verifique a configuração na Stripe.",
      502
    );
  }
}
