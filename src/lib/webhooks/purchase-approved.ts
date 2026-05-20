import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createOutboundEvent,
  enqueueDeliveries,
} from "@/lib/webhooks/outbound";

export const PURCHASE_APPROVED_ORDER_SELECT =
  "id, status, paid_at, lead_id, turma_id, product_id, total_amount_cents, currency, payment_method, installment_count, turma_name, product_name, seller_id_snapshot, seller_slug_snapshot, seller_name_snapshot, coupon_code_snapshot";

export async function enqueuePurchaseApprovedWebhook(params: {
  orderId: string;
  order: Record<string, unknown>;
}) {
  const paidAt =
    typeof params.order.paid_at === "string"
      ? params.order.paid_at
      : new Date().toISOString();

  let buyerName: string | null = null;
  let buyerEmail: string | null = null;
  let buyerPhone: string | null = null;

  if (params.order.lead_id) {
    const { data: lead } = await getSupabaseAdmin()
      .from("leads")
      .select("name, email, phone")
      .eq("id", params.order.lead_id as string)
      .maybeSingle();

    buyerName = (lead?.name as string | null) ?? null;
    buyerEmail = (lead?.email as string | null) ?? null;
    buyerPhone = (lead?.phone as string | null) ?? null;
  }

  const eventId = await createOutboundEvent({
    type: "purchase.approved",
    aggregateType: "order",
    aggregateId: params.orderId,
    payload: {
      orderId: params.orderId,
      leadId: params.order.lead_id,
      name: buyerName,
      email: buyerEmail,
      phone: buyerPhone,
      turmaId: params.order.turma_id,
      productId: params.order.product_id,
      turmaName: params.order.turma_name,
      productName: params.order.product_name,
      totalAmountCents: params.order.total_amount_cents,
      currency: params.order.currency,
      paymentMethod: params.order.payment_method,
      installmentCount: params.order.installment_count,
      sellerId: params.order.seller_id_snapshot,
      sellerSlug: params.order.seller_slug_snapshot,
      sellerName: params.order.seller_name_snapshot,
      couponCode: params.order.coupon_code_snapshot,
      paidAt,
    },
  });

  if (eventId) {
    await enqueueDeliveries(eventId);
  }
}
