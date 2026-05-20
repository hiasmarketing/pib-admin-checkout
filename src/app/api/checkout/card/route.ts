import Stripe from "stripe";
import {
  resolveCatalogProduct,
  validateCoupon,
  calculateCatalogOrderAmount,
} from "@/lib/catalog/resolve";
import { resolveSeller } from "@/lib/catalog/sellers";
import type { CatalogSelection } from "@/lib/catalog/types";
import { getStripeEnv } from "@/lib/env";
import { getStripeErrorFailureDetails } from "@/lib/payments/failures";
import { hasClientPricingOverride } from "@/lib/payments/security";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface CreateCardOrderPayload {
  leadId?: unknown;
  quantity?: unknown;
  installmentCount?: unknown;
  couponCode?: unknown;
  cpfCnpj?: unknown;
  turmaId?: unknown;
  productId?: unknown;
  sellerId?: unknown;
  sellerSlug?: unknown;
  confirmationTokenId?: unknown;
  returnUrl?: unknown;
}

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

export async function POST(request: Request) {
  let payload: CreateCardOrderPayload;

  try {
    payload = (await request.json()) as CreateCardOrderPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  if (hasClientPricingOverride(payload as Record<string, unknown>)) {
    console.warn("Rejected checkout payload with client-side pricing fields");
    return jsonError("Preço inválido. O valor do pedido vem do catálogo.", 400);
  }

  const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
  const quantity = Number(payload.quantity);
  const installmentCount = Number(payload.installmentCount);
  const cpfCnpj =
    typeof payload.cpfCnpj === "string" ? payload.cpfCnpj.replace(/\D/g, "") : "";
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
    console.error("Failed to lookup lead for order", leadError);
    return jsonError("Não foi possível iniciar o pagamento agora.", 500);
  }

  if (!lead) {
    return jsonError("Lead não encontrado.", 404);
  }

  // ── Catalog path ─────────────────────────────────────────────────────────
  if (turmaId && productId) {
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

    if (!resolved.product.paymentMethods.includes("card")) {
      return jsonError("Cartão indisponível para este produto.", 400);
    }

    if (installmentCount !== 1) {
      return jsonError("Cartão está disponível apenas para pagamento único.", 400);
    }

    // Resolve seller (best-effort: invalid seller does not block checkout)
    const sellerRecord = sellerIdInput || sellerSlugInput
      ? await resolveSeller({
          sellerId: sellerIdInput,
          sellerSlug: sellerSlugInput,
          turmaId: resolved.turma.id,
          productId: resolved.product.id,
        })
      : null;

    // Validate coupon (best-effort: invalid coupon does not block checkout)
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
        installmentCount,
        coupon: appliedCoupon,
      });
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : "Pedido inválido.",
        400
      );
    }

    const orderInsert = {
      lead_id: lead.id,
      status: "pending_payment",
      payment_method: "card",
      quantity: pricing.quantity,
      installment_count: pricing.installmentCount,
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
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderError) {
      console.error("Failed to create order (catalog)", orderError);
      return jsonError("Não foi possível criar o pedido agora.", 500);
    }

    try {
      await enqueuePipedriveSyncJob({
        type: "order.created",
        aggregateType: "order",
        aggregateId: order.id,
        payload: { source: "catalog" },
      });
    } catch (err) {
      console.error("Failed to enqueue Pipedrive order sync", err);
    }

    try {
      const stripe = new Stripe(getStripeEnv().stripeSecretKey);
      const metadata: Record<string, string> = {
        orderId: order.id,
        leadId: lead.id,
        installmentCount: String(pricing.installmentCount),
        turmaId: resolved.turma.id,
        productId: resolved.product.id,
        priceSource: "admin_catalog",
        paymentMethod: "card",
      };
      if (couponCode) metadata.couponCode = couponCode;
      if (sellerRecord?.sellerId) metadata.sellerId = sellerRecord.sellerId;
      if (sellerRecord?.slug) metadata.sellerSlug = sellerRecord.slug;
      if (sellerRecord?.name) metadata.sellerName = sellerRecord.name;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: pricing.totalAmountCents,
        currency: pricing.currency,
        confirm: Boolean(confirmationTokenId),
        confirmation_token: confirmationTokenId ?? undefined,
        return_url: returnUrl ?? undefined,
        receipt_email: typeof lead.email === "string" ? lead.email : undefined,
        metadata,
        payment_method_types: ["card"],
      });

      const { error: updateError } = await supabase
        .from("orders")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", order.id);

      if (updateError) {
        console.error("Failed to attach payment intent to order", updateError);
        return jsonError("Não foi possível preparar o pagamento agora.", 500);
      }

      return Response.json({
        orderId: order.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      });
    } catch (err) {
      console.error("Failed to create Stripe PaymentIntent (catalog)", err);
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
          console.error("Failed to persist synchronous payment failure", failureUpdateError);
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

      return jsonError("Não foi possível preparar o pagamento agora.", 502);
    }
  }
}
