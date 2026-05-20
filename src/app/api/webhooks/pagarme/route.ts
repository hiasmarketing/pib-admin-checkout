import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getPagarmeEnv } from "@/lib/env";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  enqueuePurchaseApprovedWebhook,
  PURCHASE_APPROVED_ORDER_SELECT,
} from "@/lib/webhooks/purchase-approved";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DECLINE_REASON_BY_CODE: Record<string, string> = {
  "05": "do_not_honor",
  "14": "card_declined",
  "51": "insufficient_funds",
  "54": "expired_card",
  "55": "invalid_cvv",
};

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

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isValidSignature(params: {
  rawBody: string;
  signature: string;
  secrets: string[];
}) {
  const candidates = params.secrets.flatMap((secret) => {
    const sha256 = createHmac("sha256", secret)
      .update(params.rawBody)
      .digest("hex");
    const sha1 = createHmac("sha1", secret)
      .update(params.rawBody)
      .digest("hex");

    return [`sha256=${sha256}`, sha256, `sha1=${sha1}`, sha1];
  });

  return candidates.some((candidate) => safeEqual(params.signature, candidate));
}

function getEventObject(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  return asRecord(data?.object) ?? data ?? payload;
}

function getOrderRecord(value: Record<string, unknown> | null) {
  if (!value) return null;
  const directId = optionalString(value.id);
  if (directId?.startsWith("or_")) return value;

  const order = value.order;
  if (typeof order === "string") return { id: order };
  return asRecord(order);
}

function getChargeRecord(value: Record<string, unknown> | null) {
  if (!value) return null;
  const directId = optionalString(value.id);
  if (directId?.startsWith("ch_")) return value;

  const charges = asArray(value.charges)
    .map(asRecord)
    .filter(Boolean) as Record<string, unknown>[];
  return charges[0] ?? null;
}

function getMetadata(value: Record<string, unknown> | null) {
  const orderRecord = getOrderRecord(value);
  return (
    asRecord(value?.metadata) ??
    asRecord(orderRecord?.metadata) ??
    asRecord(getChargeRecord(value)?.metadata)
  );
}

function getPagarmeOrderCode(value: Record<string, unknown> | null) {
  const orderRecord = getOrderRecord(value);
  return (
    optionalString(value?.code) ??
    optionalString(orderRecord?.code) ??
    optionalString(getChargeRecord(value)?.code)
  );
}

function getPagarmeOrderId(value: Record<string, unknown> | null) {
  const directId = optionalString(value?.id);
  if (directId?.startsWith("or_")) return directId;

  const orderRecord = getOrderRecord(value);
  return optionalString(orderRecord?.id) ?? optionalString(value?.order_id);
}

function getPagarmeChargeId(value: Record<string, unknown> | null) {
  const directId = optionalString(value?.id);
  if (directId?.startsWith("ch_")) return directId;

  return optionalString(getChargeRecord(value)?.id);
}

function getPagarmeFailureDetails(value: Record<string, unknown> | null) {
  const charge = getChargeRecord(value) ?? value;
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

async function resolveOrderId(params: {
  eventObject: Record<string, unknown> | null;
  pagarmeOrderId: string | null;
}) {
  const metadata = getMetadata(params.eventObject);
  const candidateOrderIds = [
    getPagarmeOrderCode(params.eventObject),
    optionalString(metadata?.orderId),
    optionalString(metadata?.order_id),
  ].filter((value): value is string => Boolean(value && UUID_RE.test(value)));

  for (const candidateOrderId of candidateOrderIds) {
    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("id")
      .eq("id", candidateOrderId)
      .maybeSingle();

    if (error) {
      console.error("Failed to verify pagar.me coded order", error);
      return null;
    }

    if (data?.id) return data.id as string;
  }

  if (!params.pagarmeOrderId) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id")
    .eq("pagarme_order_id", params.pagarmeOrderId)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve order by pagar.me order id", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

async function handlePaid(params: {
  eventId: string;
  eventType: string;
  orderId: string;
  pagarmeOrderId: string | null;
  pagarmeChargeId: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: currentOrder, error: lookupError } = await supabase
    .from("orders")
    .select(PURCHASE_APPROVED_ORDER_SELECT)
    .eq("id", params.orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to lookup pagar.me paid order", lookupError);
    return Response.json({ error: "Erro ao carregar pedido." }, { status: 500 });
  }

  if (!currentOrder) return null;

  const alreadyPaid = currentOrder.status === "paid" && currentOrder.paid_at;
  let orderForWebhook: Record<string, unknown> = currentOrder;

  if (!alreadyPaid) {
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        pagarme_order_id: params.pagarmeOrderId,
        pagarme_charge_id: params.pagarmeChargeId,
      })
      .eq("id", params.orderId)
      .select(PURCHASE_APPROVED_ORDER_SELECT)
      .single();

    if (updateError) {
      console.error("Failed to mark pagar.me order as paid", updateError);
      return Response.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
    }

    orderForWebhook = updatedOrder;
  }

  if (!alreadyPaid) {
    try {
      await enqueuePipedriveSyncJob({
        type: "order.paid",
        aggregateType: "order",
        aggregateId: params.orderId,
        payload: {
          pagarmeEventId: params.eventId,
          pagarmeEventType: params.eventType,
          pagarmeOrderId: params.pagarmeOrderId,
          pagarmeChargeId: params.pagarmeChargeId,
        },
      });
    } catch (err) {
      console.error("Failed to enqueue Pipedrive pagar.me paid sync", err);
    }

    try {
      await enqueuePurchaseApprovedWebhook({
        orderId: params.orderId,
        order: orderForWebhook,
      });
    } catch (err) {
      console.error("Failed to enqueue pagar.me purchase.approved webhook", err);
    }
  }

  return null;
}

async function handleFailed(params: {
  orderId: string;
  pagarmeOrderId: string | null;
  pagarmeChargeId: string | null;
  failure: { code: string | null; message: string };
}) {
  const supabase = getSupabaseAdmin();
  const { data: currentOrder, error: lookupError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", params.orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to lookup pagar.me failed order", lookupError);
    return Response.json({ error: "Erro ao carregar pedido." }, { status: 500 });
  }

  if (!currentOrder || currentOrder.status === "paid") return null;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "payment_failed",
      paid_at: null,
      pagarme_order_id: params.pagarmeOrderId,
      pagarme_charge_id: params.pagarmeChargeId,
      pagarme_decline_code: params.failure.code,
      pagarme_failure_message: params.failure.message,
    })
    .eq("id", params.orderId);

  if (updateError) {
    console.error("Failed to mark pagar.me order as failed", updateError);
    return Response.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.payment_failed",
      aggregateType: "order",
      aggregateId: params.orderId,
      payload: {
        pagarmeOrderId: params.pagarmeOrderId,
        pagarmeChargeId: params.pagarmeChargeId,
      },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive pagar.me failed sync", err);
  }

  return null;
}

async function handleCanceled(params: {
  orderId: string;
  pagarmeOrderId: string | null;
  pagarmeChargeId: string | null;
}) {
  const { data: currentOrder, error: lookupError } = await getSupabaseAdmin()
    .from("orders")
    .select("id, status")
    .eq("id", params.orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to lookup canceled pagar.me order", lookupError);
    return Response.json({ error: "Erro ao carregar pedido." }, { status: 500 });
  }

  if (!currentOrder || currentOrder.status === "paid") return null;

  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      status: "expired",
      pagarme_order_id: params.pagarmeOrderId,
      pagarme_charge_id: params.pagarmeChargeId,
    })
    .eq("id", params.orderId);

  if (error) {
    console.error("Failed to mark pagar.me order as expired", error);
    return Response.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
  }

  return null;
}

export async function POST(request: Request) {
  const signature =
    request.headers.get("x-hub-signature-256") ??
    request.headers.get("x-hub-signature");

  if (!signature) {
    return Response.json({ error: "Assinatura ausente." }, { status: 401 });
  }

  const rawBody = await request.text();
  const { pagarmeSecretKey, pagarmeWebhookSecret } = getPagarmeEnv();

  if (
    !isValidSignature({
      rawBody,
      signature,
      secrets: [pagarmeWebhookSecret, pagarmeSecretKey],
    })
  ) {
    console.error("Invalid pagar.me webhook signature");
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    payload = asRecord(parsed) ?? {};
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const eventType = optionalString(payload.type) ?? "unknown";
  const eventId =
    optionalString(payload.id) ??
    `evt_${createHash("sha256").update(rawBody).digest("hex")}`;
  const eventObject = getEventObject(payload);
  const pagarmeOrderId = getPagarmeOrderId(eventObject);
  const pagarmeChargeId = getPagarmeChargeId(eventObject);
  const orderId = await resolveOrderId({ eventObject, pagarmeOrderId });

  const supabase = getSupabaseAdmin();
  const { error: insertError } = await supabase.from("pagarme_events").insert({
    id: eventId,
    type: eventType,
    order_id: orderId,
    pagarme_order_id: pagarmeOrderId,
    payload,
  });

  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("Failed to persist pagar.me event", insertError);
      return Response.json({ error: "Erro ao registrar evento." }, { status: 500 });
    }

    return Response.json({ received: true, duplicate: true });
  }

  if (!orderId) {
    console.error("Pagar.me event has no resolvable order", {
      eventId,
      eventType,
      pagarmeOrderId,
      pagarmeChargeId,
    });
    return Response.json({ received: true });
  }

  if (eventType === "order.paid" || eventType === "charge.paid") {
    const errorResponse = await handlePaid({
      eventId,
      eventType,
      orderId,
      pagarmeOrderId,
      pagarmeChargeId,
    });
    if (errorResponse) return errorResponse;
  }

  if (
    eventType === "order.payment_failed" ||
    eventType === "charge.payment_failed"
  ) {
    const errorResponse = await handleFailed({
      orderId,
      pagarmeOrderId,
      pagarmeChargeId,
      failure: getPagarmeFailureDetails(eventObject),
    });
    if (errorResponse) return errorResponse;
  }

  if (eventType === "charge.canceled" || eventType === "order.canceled") {
    const errorResponse = await handleCanceled({
      orderId,
      pagarmeOrderId,
      pagarmeChargeId,
    });
    if (errorResponse) return errorResponse;
  }

  return Response.json({ received: true });
}
