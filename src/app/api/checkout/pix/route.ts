import Stripe from "stripe";
import {
  calculateCatalogOrderAmount,
  resolveCatalogProduct,
  validateCoupon,
} from "@/lib/catalog/resolve";
import { resolveSeller } from "@/lib/catalog/sellers";
import type { CatalogSelection } from "@/lib/catalog/types";
import { getStripeEnv } from "@/lib/env";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface CreatePixOrderPayload {
  leadId?: unknown;
  quantity?: unknown;
  couponCode?: unknown;
  cpfCnpj?: unknown;
  turmaId?: unknown;
  productId?: unknown;
  sellerId?: unknown;
  sellerSlug?: unknown;
}

const PIX_EXPIRES_AFTER_SECONDS = 15 * 60;

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

export async function POST(request: Request) {
  let payload: CreatePixOrderPayload;

  try {
    payload = (await request.json()) as CreatePixOrderPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  if (hasClientPricingOverride(payload as Record<string, unknown>)) {
    console.warn("Rejected Pix checkout payload with client-side pricing fields");
    return jsonError("Preço inválido. O valor do pedido vem do catálogo.", 400);
  }

  const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
  const quantity = Number(payload.quantity);
  const cpfCnpj =
    typeof payload.cpfCnpj === "string" ? payload.cpfCnpj.replace(/\D/g, "") : "";
  const couponCode = normalizeOptionalCode(payload.couponCode);
  const turmaId = typeof payload.turmaId === "string" ? payload.turmaId.trim() : null;
  const productId = typeof payload.productId === "string" ? payload.productId.trim() : null;
  const sellerIdInput =
    typeof payload.sellerId === "string" ? payload.sellerId.trim() : null;
  const sellerSlugInput =
    typeof payload.sellerSlug === "string" ? payload.sellerSlug.trim() : null;

  if (!UUID_RE.test(leadId)) {
    return jsonError("Lead inválido.", 400);
  }

  if (cpfCnpj.length < 11 || cpfCnpj.length > 14) {
    return jsonError("CPF/CNPJ inválido.", 400);
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
    .select("id, email, name")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    console.error("Failed to lookup lead for Pix order", leadError);
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

  if (!resolved.product.paymentMethods.includes("pix")) {
    return jsonError("Pix indisponível para este produto.", 400);
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
      payment_method: "pix",
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
    console.error("Failed to create order (pix)", orderError);
    return jsonError("Não foi possível criar o pedido agora.", 500);
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.created",
      aggregateType: "order",
      aggregateId: order.id,
      payload: { source: "pix" },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive Pix order sync", err);
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
      paymentMethod: "pix",
    };
    if (couponCode) metadata.couponCode = couponCode;
    if (sellerRecord?.sellerId) metadata.sellerId = sellerRecord.sellerId;
    if (sellerRecord?.slug) metadata.sellerSlug = sellerRecord.slug;
    if (sellerRecord?.name) metadata.sellerName = sellerRecord.name;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricing.totalAmountCents,
      currency: pricing.currency,
      receipt_email: typeof lead.email === "string" ? lead.email : undefined,
      metadata,
      payment_method_types: ["pix"],
      payment_method_data: { type: "pix" },
      payment_method_options: {
        pix: { expires_after_seconds: PIX_EXPIRES_AFTER_SECONDS },
      },
      confirm: true,
    });

    const pixQrCode = paymentIntent.next_action?.pix_display_qr_code;

    if (!pixQrCode?.data || !pixQrCode.expires_at) {
      console.error("Stripe Pix PaymentIntent has no QR code next_action", {
        orderId: order.id,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
      return jsonError("Não foi possível gerar o Pix agora.", 502);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", order.id);

    if (updateError) {
      console.error("Failed to attach Pix payment intent to order", updateError);
      return jsonError("Não foi possível preparar o pagamento agora.", 500);
    }

    return Response.json({
      orderId: order.id,
      paymentIntentId: paymentIntent.id,
      amountCents: pricing.totalAmountCents,
      currency: pricing.currency,
      pix: {
        code: pixQrCode.data,
        expiresAt: pixQrCode.expires_at,
        imageUrlPng: pixQrCode.image_url_png ?? null,
        imageUrlSvg: pixQrCode.image_url_svg ?? null,
        hostedInstructionsUrl: pixQrCode.hosted_instructions_url ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to create Stripe Pix PaymentIntent", err);
    return jsonError("Não foi possível preparar o Pix agora.", 502);
  }
}
