import {
  calculateCatalogOrderAmount,
  resolveCatalogProduct,
  validateCoupon,
  type CatalogPricingResult,
} from "@/lib/catalog/resolve";
import { applyInstallmentInterest } from "@/lib/catalog/installments";
import { resolveSeller } from "@/lib/catalog/sellers";
import type { CatalogSelection } from "@/lib/catalog/types";
import { getPagarmeEnv } from "@/lib/env";
import { hasClientPricingOverride } from "@/lib/payments/security";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  enqueuePurchaseApprovedWebhook,
  PURCHASE_APPROVED_ORDER_SELECT,
} from "@/lib/webhooks/purchase-approved";

interface CreatePagarmeOrderPayload {
  leadId?: unknown;
  quantity?: unknown;
  installmentCount?: unknown;
  couponCode?: unknown;
  cpfCnpj?: unknown;
  turmaId?: unknown;
  productId?: unknown;
  sellerId?: unknown;
  sellerSlug?: unknown;
  paymentMethod?: unknown;
  cardToken?: unknown;
  pixExpiresIn?: unknown;
}

type PagarmePaymentMethod = "credit_card" | "pix";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PIX_EXPIRES_IN_SECONDS = 60 * 60;

const DECLINE_REASON_BY_CODE: Record<string, string> = {
  "05": "do_not_honor",
  "14": "card_declined",
  "51": "insufficient_funds",
  "54": "expired_card",
  "55": "invalid_cvv",
};
const PAGARME_TURMA_MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARCO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

class PagarmeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: unknown
  ) {
    super("Pagar.me API request failed.");
    this.name = "PagarmeApiError";
  }
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeOptionalCode(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase()
    : null;
}

function normalizePaymentMethod(value: unknown): PagarmePaymentMethod | null {
  if (value === "credit_card" || value === "pix") return value;
  return null;
}

function normalizePixExpiresIn(value: unknown) {
  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds >= 60 && seconds <= 24 * 60 * 60) {
    return seconds;
  }

  return DEFAULT_PIX_EXPIRES_IN_SECONDS;
}

function normalizeBrazilPhone(value: unknown) {
  let digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length < 10) return null;

  return {
    country_code: "55",
    area_code: digits.slice(0, 2),
    number: digits.slice(2),
  };
}

function getPagarmeTurmaMetadata(turma: {
  name: string;
  startsAt: string | null;
}) {
  const dateMatch = turma.startsAt?.match(/^(\d{4})-(\d{2})/);
  if (dateMatch) {
    const monthIndex = Number(dateMatch[2]) - 1;
    const monthName = PAGARME_TURMA_MONTHS[monthIndex];
    if (monthName) return `${monthName}/${dateMatch[1].slice(-2)}`;
  }

  return turma.name;
}

function getPagarmeFailureDetails(charge: Record<string, unknown> | null) {
  const lastTransaction = asRecord(charge?.last_transaction);
  const gatewayResponse = asRecord(lastTransaction?.gateway_response);
  const errors = asArray(gatewayResponse?.errors)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  const firstError = errors[0] ?? null;
  const code =
    optionalString(lastTransaction?.acquirer_return_code) ??
    optionalString(lastTransaction?.acquirer_response_code) ??
    optionalString(firstError?.code) ??
    optionalString(gatewayResponse?.code);
  const message =
    optionalString(lastTransaction?.acquirer_message) ??
    optionalString(firstError?.message) ??
    optionalString(gatewayResponse?.message) ??
    "Pagamento recusado pelo provedor.";

  return {
    code,
    message,
    declineReason: code ? DECLINE_REASON_BY_CODE[code] ?? "generic_decline" : "generic_decline",
  };
}

function getPagarmeErrorMessage(value: unknown) {
  const record = asRecord(value);
  if (!record) return "Pagar.me indisponível no momento.";

  const directMessage = optionalString(record.message);
  if (directMessage) return directMessage;

  const errors = asArray(record.errors)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  const firstMessage = errors
    .map((error) => optionalString(error.message))
    .find(Boolean);

  return firstMessage ?? "Pagar.me indisponível no momento.";
}

async function createPagarmeOrder(body: Record<string, unknown>) {
  const { pagarmeBaseUrl, pagarmeSecretKey } = getPagarmeEnv();
  const response = await fetch(`${pagarmeBaseUrl}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${pagarmeSecretKey}:`).toString(
        "base64"
      )}`,
      "Content-Type": "application/json",
      "User-Agent": "pib-checkout/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new PagarmeApiError(response.status, responseBody);
  }

  return responseBody as Record<string, unknown>;
}

export async function POST(request: Request) {
  let payload: CreatePagarmeOrderPayload;

  try {
    payload = (await request.json()) as CreatePagarmeOrderPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  if (hasClientPricingOverride(payload as Record<string, unknown>)) {
    console.warn("Rejected pagar.me payload with client-side pricing fields");
    return jsonError("Preço inválido. O valor do pedido vem do catálogo.", 400);
  }

  const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
  const quantity = Number(payload.quantity) || 1;
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const requestedInstallmentCount = Number(payload.installmentCount) || 1;
  const installmentCount =
    paymentMethod === "pix" ? 1 : requestedInstallmentCount;
  const cpfCnpj =
    typeof payload.cpfCnpj === "string" ? payload.cpfCnpj.replace(/\D/g, "") : "";
  const couponCode = normalizeOptionalCode(payload.couponCode);
  const turmaId = typeof payload.turmaId === "string" ? payload.turmaId.trim() : null;
  const productId = typeof payload.productId === "string" ? payload.productId.trim() : null;
  const sellerIdInput =
    typeof payload.sellerId === "string" ? payload.sellerId.trim() : null;
  const sellerSlugInput =
    typeof payload.sellerSlug === "string" ? payload.sellerSlug.trim() : null;
  const cardToken =
    typeof payload.cardToken === "string" ? payload.cardToken.trim() : null;

  if (!paymentMethod) {
    return jsonError("Método de pagamento inválido.", 400);
  }

  if (!UUID_RE.test(leadId)) {
    return jsonError("Lead inválido.", 400);
  }

  if (cpfCnpj.length < 11 || cpfCnpj.length > 14) {
    return jsonError("CPF/CNPJ inválido.", 400);
  }

  if (paymentMethod === "credit_card" && !cardToken) {
    return jsonError("Token do cartão ausente.", 400);
  }

  if (!turmaId || !productId) {
    return jsonError(
      "Turma e produto são obrigatórios para calcular o preço pelo admin.",
      400
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, email, name, phone")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    console.error("Failed to lookup lead for pagar.me order", leadError);
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

  const productPaymentMethod = paymentMethod === "credit_card" ? "card" : "pix";
  if (!resolved.product.paymentMethods.includes(productPaymentMethod)) {
    return jsonError("Método de pagamento indisponível para este produto.", 400);
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

  let pricing: CatalogPricingResult;
  try {
    pricing = calculateCatalogOrderAmount({
      product: resolved.product,
      quantity,
      installmentCount,
      coupon: appliedCoupon,
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Pedido inválido.",
      400
    );
  }

  const installmentRatePct =
    paymentMethod === "credit_card"
      ? resolved.product.installmentRates[String(pricing.installmentCount)] ?? null
      : null;
  const installmentResult = applyInstallmentInterest(
    pricing.totalAmountCents,
    pricing.installmentCount,
    installmentRatePct
  );
  const pagarmeAmountCents =
    paymentMethod === "pix" ? pricing.totalAmountCents : installmentResult.totalCents;

  const orderInsert = {
    lead_id: lead.id,
    status: "pending_payment",
    payment_method: productPaymentMethod,
    quantity: pricing.quantity,
    installment_count: pricing.installmentCount,
    unit_amount_cents: Math.ceil(pricing.subtotalAmountCents / pricing.quantity),
    subtotal_amount_cents: pricing.subtotalAmountCents,
    discount_amount_cents: pricing.discountAmountCents,
    total_amount_cents: pagarmeAmountCents,
    currency: "brl",
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
    installment_rate_pct:
      paymentMethod === "credit_card" ? installmentResult.interestRatePct : null,
    installment_amount_cents:
      paymentMethod === "credit_card"
        ? installmentResult.perInstallmentCents
        : null,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderInsert)
    .select("id")
    .single();

  if (orderError) {
    console.error("Failed to create pagar.me order", orderError);
    return jsonError("Não foi possível criar o pedido agora.", 500);
  }

  const customerPhone = normalizeBrazilPhone(lead.phone);
  const customer: Record<string, unknown> = {
    name: optionalString(lead.name) ?? "Cliente PIB",
    email: optionalString(lead.email) ?? "",
    type: cpfCnpj.length === 14 ? "company" : "individual",
    document: cpfCnpj,
    document_type: cpfCnpj.length === 14 ? "CNPJ" : "CPF",
  };
  if (customerPhone) {
    customer.phones = { mobile_phone: customerPhone };
  }

  const payment =
    paymentMethod === "credit_card"
      ? {
          payment_method: "credit_card",
          credit_card: {
            operation_type: "auth_and_capture",
            installments: pricing.installmentCount,
            statement_descriptor: "DESTINY",
            card_token: cardToken,
          },
        }
      : {
          payment_method: "pix",
          pix: { expires_in: normalizePixExpiresIn(payload.pixExpiresIn) },
        };

  let pagarmeOrder: Record<string, unknown>;
  try {
    pagarmeOrder = await createPagarmeOrder({
      code: order.id,
      closed: true,
      items: [
        {
          amount: pagarmeAmountCents,
          description: resolved.product.name,
          quantity: 1,
          code: resolved.product.slug,
        },
      ],
      customer,
      payments: [payment],
      metadata: {
        turma: getPagarmeTurmaMetadata(resolved.turma),
      },
    });
  } catch (err) {
    console.error("Failed to create pagar.me order", err);
    const message =
      err instanceof PagarmeApiError
        ? getPagarmeErrorMessage(err.responseBody)
        : "Não foi possível processar o pagamento agora.";

    await supabase
      .from("orders")
      .update({
        status: "payment_failed",
        pagarme_failure_message: message,
      })
      .eq("id", order.id);

    return Response.json(
      {
        error: message,
        orderId: order.id,
        status: "payment_failed",
      },
      { status: err instanceof PagarmeApiError && err.status < 500 ? 400 : 502 }
    );
  }

  const charges = asArray(pagarmeOrder.charges)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  const charge = charges[0] ?? null;
  const chargeStatus = optionalString(charge?.status);
  const orderStatus = optionalString(pagarmeOrder.status);
  const pagarmeOrderId = optionalString(pagarmeOrder.id);
  const pagarmeChargeId = optionalString(charge?.id);
  const lastTransaction = asRecord(charge?.last_transaction);
  const pixQrCode = optionalString(lastTransaction?.qr_code);
  const pixQrCodeUrl = optionalString(lastTransaction?.qr_code_url);
  const pixExpiresAt =
    optionalString(lastTransaction?.expires_at) ??
    (paymentMethod === "pix"
      ? new Date(
          Date.now() + normalizePixExpiresIn(payload.pixExpiresIn) * 1000
        ).toISOString()
      : null);

  const isPaid = orderStatus === "paid" || chargeStatus === "paid";
  const isFailed =
    orderStatus === "failed" ||
    chargeStatus === "failed" ||
    chargeStatus === "payment_failed";

  if (isPaid) {
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        pagarme_order_id: pagarmeOrderId,
        pagarme_charge_id: pagarmeChargeId,
      })
      .eq("id", order.id)
      .select(PURCHASE_APPROVED_ORDER_SELECT)
      .single();

    if (updateError) {
      console.error("Failed to mark pagar.me order as paid", updateError);
      return jsonError("Pagamento aprovado, mas houve erro ao atualizar o pedido.", 500);
    }

    try {
      await enqueuePurchaseApprovedWebhook({
        orderId: order.id,
        order: updatedOrder,
      });
    } catch (err) {
      console.error("Failed to enqueue pagar.me paid side effects", err);
    }

    return Response.json({ orderId: order.id, status: "paid" });
  }

  if (isFailed) {
    const failure = getPagarmeFailureDetails(charge);
    await supabase
      .from("orders")
      .update({
        status: "payment_failed",
        paid_at: null,
        pagarme_order_id: pagarmeOrderId,
        pagarme_charge_id: pagarmeChargeId,
        pagarme_decline_code: failure.code,
        pagarme_failure_message: failure.message,
      })
      .eq("id", order.id);

    return Response.json(
      {
        error: failure.message,
        declineReason: failure.declineReason,
        orderId: order.id,
        status: "payment_failed",
      },
      { status: 402 }
    );
  }

  const { error: pendingUpdateError } = await supabase
    .from("orders")
    .update({
      pagarme_order_id: pagarmeOrderId,
      pagarme_charge_id: pagarmeChargeId,
      pix_expires_at: pixExpiresAt,
      pix_qr_code: pixQrCode,
    })
    .eq("id", order.id);

  if (pendingUpdateError) {
    console.error("Failed to attach pagar.me identifiers to order", pendingUpdateError);
    return jsonError("Não foi possível atualizar o pedido agora.", 500);
  }

  if (paymentMethod === "pix") {
    if (!pixQrCode) {
      console.error("Pagar.me Pix response missing QR code", {
        orderId: order.id,
        pagarmeOrderId,
      });
      return jsonError("Não foi possível gerar o Pix agora.", 502);
    }

    return Response.json({
      orderId: order.id,
      pagarmeOrderId,
      status: "pending",
      pix: {
        qrCode: pixQrCode,
        qrCodeUrl: pixQrCodeUrl,
        expiresAt: pixExpiresAt,
      },
    });
  }

  return Response.json({
    orderId: order.id,
    pagarmeOrderId,
    status: "pending_payment",
  });
}
