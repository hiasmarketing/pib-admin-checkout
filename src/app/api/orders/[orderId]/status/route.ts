import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPagarmeEnv } from "@/lib/env";
import {
  enqueuePurchaseApprovedWebhook,
  PURCHASE_APPROVED_ORDER_SELECT,
} from "@/lib/webhooks/purchase-approved";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderStatusRow = {
  id: string;
  status: string;
  lead_id: string;
  pix_expires_at: string | null;
  pagarme_order_id: string | null;
  pagarme_charge_id: string | null;
  pagarme_decline_code: string | null;
  pagarme_failure_message: string | null;
};

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

function getFirstCharge(value: Record<string, unknown>) {
  const charges = asArray(value.charges)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  return charges[0] ?? null;
}

function getPagarmeFailureMessage(charge: Record<string, unknown> | null) {
  const lastTransaction = asRecord(charge?.last_transaction);
  const gatewayResponse = asRecord(lastTransaction?.gateway_response);
  const errors = asArray(gatewayResponse?.errors)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  const firstError = errors[0] ?? null;

  return (
    optionalString(lastTransaction?.acquirer_message) ??
    optionalString(firstError?.message) ??
    optionalString(gatewayResponse?.message) ??
    "Pagamento recusado pelo provedor."
  );
}

async function getPagarmeOrder(pagarmeOrderId: string) {
  const { pagarmeBaseUrl, pagarmeSecretKey } = getPagarmeEnv();
  const response = await fetch(`${pagarmeBaseUrl}/orders/${pagarmeOrderId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${pagarmeSecretKey}:`).toString(
        "base64"
      )}`,
      "Content-Type": "application/json",
      "User-Agent": "pib-checkout/1.0",
    },
    cache: "no-store",
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Failed to fetch pagar.me order status", {
      status: response.status,
      responseBody,
      pagarmeOrderId,
    });
    return null;
  }

  return asRecord(responseBody);
}

async function reconcilePagarmeStatus(
  order: OrderStatusRow
): Promise<OrderStatusRow> {
  if (order.status !== "pending_payment" || !order.pagarme_order_id) {
    return order;
  }

  const pagarmeOrder = await getPagarmeOrder(order.pagarme_order_id);
  if (!pagarmeOrder) return order;

  const charge = getFirstCharge(pagarmeOrder);
  const orderStatus = optionalString(pagarmeOrder.status);
  const chargeStatus = optionalString(charge?.status);
  const pagarmeChargeId =
    optionalString(charge?.id) ?? order.pagarme_charge_id;
  const isPaid = orderStatus === "paid" || chargeStatus === "paid";
  const isFailed =
    orderStatus === "failed" ||
    chargeStatus === "failed" ||
    chargeStatus === "payment_failed";
  const isCanceled =
    orderStatus === "canceled" ||
    orderStatus === "cancelled" ||
    chargeStatus === "canceled" ||
    chargeStatus === "cancelled";

  if (isPaid) {
    const paidAt = new Date().toISOString();
    const { data: updatedOrder, error } = await getSupabaseAdmin()
      .from("orders")
      .update({
        status: "paid",
        paid_at: paidAt,
        pagarme_charge_id: pagarmeChargeId,
      })
      .eq("id", order.id)
      .eq("status", "pending_payment")
      .select(PURCHASE_APPROVED_ORDER_SELECT)
      .maybeSingle();

    if (error) {
      console.error("Failed to reconcile paid pagar.me order", error);
      return order;
    }

    if (updatedOrder) {
      try {
        await enqueuePurchaseApprovedWebhook({
          orderId: order.id,
          order: updatedOrder,
        });
      } catch (err) {
        console.error("Failed to enqueue pagar.me poll purchase webhook", err);
      }
    }

    return { ...order, status: "paid", pagarme_charge_id: pagarmeChargeId };
  }

  if (isFailed) {
    const failureMessage = getPagarmeFailureMessage(charge);
    const { error } = await getSupabaseAdmin()
      .from("orders")
      .update({
        status: "payment_failed",
        paid_at: null,
        pagarme_charge_id: pagarmeChargeId,
        pagarme_failure_message: failureMessage,
      })
      .eq("id", order.id)
      .eq("status", "pending_payment");

    if (error) {
      console.error("Failed to reconcile failed pagar.me order", error);
      return order;
    }

    return {
      ...order,
      status: "payment_failed",
      pagarme_charge_id: pagarmeChargeId,
      pagarme_failure_message: failureMessage,
    };
  }

  if (isCanceled) {
    const { error } = await getSupabaseAdmin()
      .from("orders")
      .update({
        status: "expired",
        pagarme_charge_id: pagarmeChargeId,
      })
      .eq("id", order.id)
      .eq("status", "pending_payment");

    if (error) {
      console.error("Failed to reconcile canceled pagar.me order", error);
      return order;
    }

    return { ...order, status: "expired", pagarme_charge_id: pagarmeChargeId };
  }

  return order;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId") ?? "";

  if (!UUID_RE.test(orderId) || !UUID_RE.test(leadId)) {
    return jsonError("Pedido não encontrado.", 404);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "id, status, lead_id, pix_expires_at, pagarme_order_id, pagarme_charge_id, pagarme_decline_code, pagarme_failure_message"
    )
    .eq("id", orderId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) {
    console.error("Failed to lookup order status", error);
    return jsonError("Não foi possível carregar o status agora.", 500);
  }

  if (!data) {
    return jsonError("Pedido não encontrado.", 404);
  }

  const order = await reconcilePagarmeStatus(data as OrderStatusRow);
  const pixExpiresAt =
    typeof order.pix_expires_at === "string"
      ? new Date(order.pix_expires_at)
      : null;
  const isExpired =
    order.status === "pending_payment" &&
    pixExpiresAt !== null &&
    Number.isFinite(pixExpiresAt.getTime()) &&
    pixExpiresAt.getTime() <= Date.now();
  const status = isExpired ? "expired" : order.status;

  return Response.json({
    status,
    pagarmeDeclineCode: order.pagarme_decline_code ?? null,
    pagarmeFailureMessage: order.pagarme_failure_message ?? null,
  });
}
