import Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";
import { enqueuePipedriveSyncJob } from "@/lib/pipedrive/jobs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  enqueuePurchaseApprovedWebhook,
  PURCHASE_APPROVED_ORDER_SELECT,
} from "@/lib/webhooks/purchase-approved";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPaymentIntentEvent(event: Stripe.Event) {
  return (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  );
}

function isRefundEvent(event: Stripe.Event) {
  return (
    event.type === "refund.created" ||
    event.type === "refund.updated" ||
    event.type === "refund.failed"
  );
}

function isDisputeEvent(event: Stripe.Event) {
  return (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.updated" ||
    event.type === "charge.dispute.closed" ||
    event.type === "charge.dispute.funds_withdrawn" ||
    event.type === "charge.dispute.funds_reinstated"
  );
}

function getStripeId(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : null;
}

async function resolveOrderIdByPaymentIntentId(paymentIntentId: string | null) {
  if (!paymentIntentId) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve order by PaymentIntent id", error);
    return null;
  }

  return data?.id ?? null;
}

async function resolveOrderId(paymentIntent: Stripe.PaymentIntent) {
  const metadataOrderId = paymentIntent.metadata?.orderId;

  if (metadataOrderId && UUID_RE.test(metadataOrderId)) {
    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("id")
      .eq("id", metadataOrderId)
      .maybeSingle();

    if (error) {
      console.error("Failed to verify metadata order for Stripe event", error);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  return resolveOrderIdByPaymentIntentId(paymentIntent.id);
}

async function persistRefundEvent(params: {
  event: Stripe.Event;
  refund: Stripe.Refund;
  orderId: string | null;
  paymentIntentId: string | null;
}) {
  const chargeId = getStripeId(params.refund.charge);
  const { error } = await getSupabaseAdmin().from("stripe_refunds").upsert(
    {
      id: params.refund.id,
      order_id: params.orderId,
      payment_intent_id: params.paymentIntentId,
      charge_id: chargeId,
      status: params.refund.status,
      amount_cents: params.refund.amount,
      currency: params.refund.currency,
      reason: params.refund.reason,
      failure_reason: params.refund.failure_reason ?? null,
      payload: params.refund,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Failed to persist Stripe refund event", {
      eventId: params.event.id,
      refundId: params.refund.id,
      error,
    });
    return Response.json({ error: "Erro ao registrar refund." }, { status: 500 });
  }

  return null;
}

async function persistDisputeEvent(params: {
  event: Stripe.Event;
  dispute: Stripe.Dispute;
  orderId: string | null;
  paymentIntentId: string | null;
}) {
  const chargeId = getStripeId(params.dispute.charge);
  const dueBy = params.dispute.evidence_details?.due_by;
  const values: Record<string, unknown> = {
    id: params.dispute.id,
    order_id: params.orderId,
    payment_intent_id: params.paymentIntentId,
    charge_id: chargeId,
    status: params.dispute.status,
    reason: params.dispute.reason,
    amount_cents: params.dispute.amount,
    currency: params.dispute.currency,
    evidence_due_by:
      typeof dueBy === "number" ? new Date(dueBy * 1000).toISOString() : null,
    last_event_type: params.event.type,
    payload: params.dispute,
  };

  if (params.event.type === "charge.dispute.funds_withdrawn") {
    values.funds_withdrawn_at = new Date(params.event.created * 1000).toISOString();
  }

  if (params.event.type === "charge.dispute.funds_reinstated") {
    values.funds_reinstated_at = new Date(params.event.created * 1000).toISOString();
  }

  const { error } = await getSupabaseAdmin()
    .from("stripe_disputes")
    .upsert(values, { onConflict: "id" });

  if (error) {
    console.error("Failed to persist Stripe dispute event", {
      eventId: params.event.id,
      disputeId: params.dispute.id,
      error,
    });
    return Response.json({ error: "Erro ao registrar disputa." }, { status: 500 });
  }

  if (params.event.type === "charge.dispute.created") {
    const { error: alertError } = await getSupabaseAdmin()
      .from("stripe_operational_alerts")
      .insert({
        type: "stripe.dispute.created",
        order_id: params.orderId,
        stripe_event_id: params.event.id,
        stripe_dispute_id: params.dispute.id,
        payload: {
          disputeId: params.dispute.id,
          paymentIntentId: params.paymentIntentId,
          chargeId,
          amountCents: params.dispute.amount,
          currency: params.dispute.currency,
          reason: params.dispute.reason,
          evidenceDueBy: values.evidence_due_by,
        },
      });

    if (alertError && alertError.code !== "23505") {
      console.error("Failed to create Stripe dispute alert", {
        eventId: params.event.id,
        disputeId: params.dispute.id,
        error: alertError,
      });
      return Response.json({ error: "Erro ao criar alerta." }, { status: 500 });
    }
  }

  return null;
}

async function handlePaymentIntentSucceeded(params: {
  event: Stripe.Event;
  paymentIntent: Stripe.PaymentIntent;
  orderId: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: currentOrder, error: lookupError } = await supabase
    .from("orders")
    .select(PURCHASE_APPROVED_ORDER_SELECT)
    .eq("id", params.orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to lookup paid order", lookupError);
    return Response.json({ error: "Erro ao carregar pedido." }, { status: 500 });
  }

  if (!currentOrder) {
    console.error("Stripe event references missing order", {
      eventId: params.event.id,
      orderId: params.orderId,
      paymentIntentId: params.paymentIntent.id,
    });
    return null;
  }

  let orderForWebhook: Record<string, unknown> = currentOrder;

  if (currentOrder.status !== "paid" || !currentOrder.paid_at) {
    const { error, data: updatedOrder } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: currentOrder.paid_at ?? new Date().toISOString(),
      })
      .eq("id", params.orderId)
      .select(PURCHASE_APPROVED_ORDER_SELECT)
      .single();

    if (error) {
      console.error("Failed to mark order as paid", error);
      return Response.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
    }

    orderForWebhook = updatedOrder;
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.paid",
      aggregateType: "order",
      aggregateId: params.orderId,
      payload: {
        stripeEventId: params.event.id,
        paymentIntentId: params.paymentIntent.id,
      },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive paid sync", err);
  }

  try {
    await enqueuePurchaseApprovedWebhook({
      orderId: params.orderId,
      order: orderForWebhook,
    });
  } catch (webhookErr) {
    // Non-blocking: order is already marked paid; outbound delivery can be retried.
    console.error("Failed to enqueue purchase.approved webhook", webhookErr);
  }

  return null;
}

async function handlePaymentIntentFailed(params: {
  event: Stripe.Event;
  paymentIntent: Stripe.PaymentIntent;
  orderId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: currentOrder, error: lookupError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", params.orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to lookup failed order", lookupError);
    return Response.json({ error: "Erro ao carregar pedido." }, { status: 500 });
  }

  if (!currentOrder) {
    console.error("Stripe failed event references missing order", {
      eventId: params.event.id,
      orderId: params.orderId,
      paymentIntentId: params.paymentIntent.id,
    });
    return null;
  }

  if (currentOrder.status === "paid") {
    return null;
  }

  const lastError = params.paymentIntent.last_payment_error;
  const { error } = await supabase
    .from("orders")
    .update({
      status: "payment_failed",
      paid_at: null,
      stripe_decline_code: lastError?.decline_code ?? null,
      stripe_failure_code: lastError?.code ?? null,
    })
    .eq("id", params.orderId);

  if (error) {
    console.error("Failed to mark order as payment_failed", error);
    return Response.json({ error: "Erro ao atualizar pedido." }, { status: 500 });
  }

  try {
    await enqueuePipedriveSyncJob({
      type: "order.payment_failed",
      aggregateType: "order",
      aggregateId: params.orderId,
      payload: {
        stripeEventId: params.event.id,
        paymentIntentId: params.paymentIntent.id,
      },
    });
  } catch (err) {
    console.error("Failed to enqueue Pipedrive failed sync", err);
  }

  return null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  const rawBody = await request.text();
  const { stripeSecretKey, stripeWebhookSecret } = getStripeEnv();
  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return Response.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const paymentIntent = isPaymentIntentEvent(event)
    ? (event.data.object as Stripe.PaymentIntent)
    : null;
  const refund = isRefundEvent(event) ? (event.data.object as Stripe.Refund) : null;
  const dispute = isDisputeEvent(event) ? (event.data.object as Stripe.Dispute) : null;
  const refundPaymentIntentId = refund ? getStripeId(refund.payment_intent) : null;
  const disputePaymentIntentId = dispute ? getStripeId(dispute.payment_intent) : null;
  const paymentIntentId =
    paymentIntent?.id ?? refundPaymentIntentId ?? disputePaymentIntentId ?? null;
  const orderId = paymentIntent
    ? await resolveOrderId(paymentIntent)
    : await resolveOrderIdByPaymentIntentId(paymentIntentId);

  const { error: insertError } = await supabase.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payment_intent_id: paymentIntentId,
    order_id: orderId,
    payload: event,
  });

  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("Failed to persist Stripe event", insertError);
      return Response.json({ error: "Erro ao registrar evento." }, { status: 500 });
    }

    return Response.json({ received: true, duplicate: true });
  }

  if (refund) {
    const errorResponse = await persistRefundEvent({
      event,
      refund,
      orderId,
      paymentIntentId,
    });
    if (errorResponse) {
      return errorResponse;
    }

    if (!orderId) {
      console.error("Stripe refund event has no resolvable order", {
        eventId: event.id,
        refundId: refund.id,
        paymentIntentId,
      });
    }

    return Response.json({ received: true });
  }

  if (dispute) {
    const errorResponse = await persistDisputeEvent({
      event,
      dispute,
      orderId,
      paymentIntentId,
    });
    if (errorResponse) {
      return errorResponse;
    }

    if (!orderId) {
      console.error("Stripe dispute event has no resolvable order", {
        eventId: event.id,
        disputeId: dispute.id,
        paymentIntentId,
      });
    }

    return Response.json({ received: true });
  }

  if (!paymentIntent || !orderId) {
    if (paymentIntent && !orderId) {
      console.error("Stripe event has no resolvable order", {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
      });
    }

    return Response.json({ received: true });
  }

  if (event.type === "payment_intent.succeeded") {
    const errorResponse = await handlePaymentIntentSucceeded({
      event,
      paymentIntent,
      orderId,
    });
    if (errorResponse) {
      return errorResponse;
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const errorResponse = await handlePaymentIntentFailed({
      event,
      paymentIntent,
      orderId,
    });
    if (errorResponse) {
      return errorResponse;
    }
  }

  return Response.json({ received: true });
}
