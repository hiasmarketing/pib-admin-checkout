import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type OutboundWebhookEventType = "lead.abandoned" | "purchase.approved";
export type OutboundWebhookDeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "dead";

export interface OutboundWebhookEndpointDTO {
  id: string;
  shortId: string;
  name: string;
  url: string;
  active: boolean;
  subscribedEvents: OutboundWebhookEventType[];
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutboundWebhookEndpointInput {
  name: string;
  url: string;
  active: boolean;
  subscribedEvents: OutboundWebhookEventType[];
  secret?: string | null;
}

export interface OutboundDeliveryDTO {
  id: string;
  eventId: string;
  endpointId: string;
  endpointName: string;
  endpointUrl: string;
  eventType: OutboundWebhookEventType;
  status: OutboundWebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
}

const MAX_RETRIES = 5;
const DEAD_STATUS_CODES = [400, 401, 403, 404, 410];

function validateEndpointUrl(url: string): void {
  try {
    const parsed = new URL(url);
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && parsed.protocol !== "https:") {
      throw new Error("URL do endpoint deve usar HTTPS em produção.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL do endpoint deve usar http ou https.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("HTTPS")) throw e;
    if (e instanceof Error && e.message.includes("http")) throw e;
    throw new Error("URL do endpoint é inválida.");
  }
}

function encryptSecret(secret: string): string {
  // Simple base64 encoding as placeholder — replace with real AES-GCM encryption
  // when OUTBOUND_WEBHOOK_SECRET_ENCRYPTION_KEY is provided in production
  return Buffer.from(secret).toString("base64");
}

function decryptSecret(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

function mapEndpointRow(row: Record<string, unknown>): OutboundWebhookEndpointDTO {
  return {
    id: row.id as string,
    shortId: row.short_id as string,
    name: row.name as string,
    url: row.url as string,
    active: row.active as boolean,
    subscribedEvents: row.subscribed_events as OutboundWebhookEventType[],
    hasSecret: !!row.secret_encrypted,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listWebhookEndpoints(): Promise<
  OutboundWebhookEndpointDTO[]
> {
  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_endpoints")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Falha ao listar endpoints.");

  return (data ?? []).map(mapEndpointRow);
}

export async function getWebhookEndpoint(
  id: string
): Promise<OutboundWebhookEndpointDTO | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_endpoints")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar endpoint.");
  if (!data) return null;

  return mapEndpointRow(data);
}

export async function getWebhookEndpointByShortId(
  shortId: string
): Promise<OutboundWebhookEndpointDTO | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_endpoints")
    .select("*")
    .eq("short_id", shortId)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar endpoint.");
  if (!data) return null;

  return mapEndpointRow(data);
}

export async function createWebhookEndpoint(
  input: OutboundWebhookEndpointInput
): Promise<OutboundWebhookEndpointDTO> {
  validateEndpointUrl(input.url);

  if (!input.name?.trim()) {
    throw new Error("Nome do endpoint é obrigatório.");
  }

  if (!Array.isArray(input.subscribedEvents) || input.subscribedEvents.length === 0) {
    throw new Error("Pelo menos um evento deve ser selecionado.");
  }

  const validEvents: OutboundWebhookEventType[] = [
    "lead.abandoned",
    "purchase.approved",
  ];
  for (const e of input.subscribedEvents) {
    if (!validEvents.includes(e)) {
      throw new Error(`Evento inválido: ${e}`);
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_endpoints")
    .insert({
      name: input.name.trim(),
      url: input.url.trim(),
      active: input.active,
      subscribed_events: input.subscribedEvents,
      secret_encrypted: input.secret ? encryptSecret(input.secret) : null,
    })
    .select("*")
    .single();

  if (error) throw new Error("Falha ao criar endpoint.");

  return mapEndpointRow(data);
}

export async function updateWebhookEndpoint(
  id: string,
  input: OutboundWebhookEndpointInput
): Promise<OutboundWebhookEndpointDTO> {
  validateEndpointUrl(input.url);

  if (!input.name?.trim()) {
    throw new Error("Nome do endpoint é obrigatório.");
  }

  const validEvents: OutboundWebhookEventType[] = [
    "lead.abandoned",
    "purchase.approved",
  ];
  for (const e of input.subscribedEvents) {
    if (!validEvents.includes(e)) {
      throw new Error(`Evento inválido: ${e}`);
    }
  }

  const updateData: Record<string, unknown> = {
    name: input.name.trim(),
    url: input.url.trim(),
    active: input.active,
    subscribed_events: input.subscribedEvents,
  };

  // Only update secret if a new one is explicitly provided
  if (input.secret) {
    updateData.secret_encrypted = encryptSecret(input.secret);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_endpoints")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error("Falha ao atualizar endpoint.");

  return mapEndpointRow(data);
}

export async function createOutboundEvent(params: {
  type: OutboundWebhookEventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("outbound_events")
    .insert({
      type: params.type,
      aggregate_type: params.aggregateType,
      aggregate_id: params.aggregateId,
      payload: params.payload,
    })
    .select("id")
    .single();

  if (error) {
    // unique constraint violation = already exists, idempotent
    if (error.code === "23505") return null;
    throw new Error("Falha ao criar evento outbound.");
  }

  return data.id as string;
}

export async function enqueueDeliveries(eventId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("outbound_events")
    .select("type")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return;

  const { data: endpoints } = await supabase
    .from("outbound_webhook_endpoints")
    .select("id")
    .eq("active", true)
    .contains("subscribed_events", [event.type as string]);

  if (!endpoints || endpoints.length === 0) return;

  const deliveries = endpoints.map((ep) => ({
    event_id: eventId,
    endpoint_id: ep.id as string,
    status: "pending" as const,
  }));

  await supabase
    .from("outbound_webhook_deliveries")
    .upsert(deliveries, { onConflict: "event_id,endpoint_id", ignoreDuplicates: true });
}

function computeNextAttempt(attemptCount: number): Date {
  // Exponential backoff: 30s, 2min, 8min, 32min, 128min
  const delayMs = Math.min(30_000 * Math.pow(4, attemptCount), 7_680_000);
  return new Date(Date.now() + delayMs);
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendDueDeliveries(now: Date): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: deliveries } = await supabase
    .from("outbound_webhook_deliveries")
    .select(
      `
      id,
      event_id,
      endpoint_id,
      attempt_count,
      outbound_events (type, payload),
      outbound_webhook_endpoints (url, secret_encrypted, active)
    `
    )
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(50);

  if (!deliveries || deliveries.length === 0) return;

  for (const delivery of deliveries) {
    const event = delivery.outbound_events as unknown as Record<string, unknown> | null;
    const endpoint = delivery.outbound_webhook_endpoints as unknown as Record<
      string,
      unknown
    > | null;

    if (!event || !endpoint) continue;
    if (!endpoint.active) continue;

    const deliveryId = delivery.id as string;
    const attemptCount = (delivery.attempt_count as number) + 1;

    // Mark as processing
    await supabase
      .from("outbound_webhook_deliveries")
      .update({ status: "processing", last_attempt_at: now.toISOString() })
      .eq("id", deliveryId);

    const payloadObj = {
      eventId: delivery.event_id as string,
      type: event.type as string,
      occurredAt: new Date().toISOString(),
      data: event.payload as Record<string, unknown>,
    };
    const payloadStr = JSON.stringify(payloadObj);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Pib-Event": event.type as string,
    };

    if (endpoint.secret_encrypted) {
      const secret = decryptSecret(endpoint.secret_encrypted as string);
      const sig = await signPayload(payloadStr, secret);
      headers["X-Pib-Signature"] = `sha256=${sig}`;
    }

    let statusCode: number | null = null;
    let lastError: string | null = null;
    let newStatus: OutboundWebhookDeliveryStatus = "failed";
    let deliveredAt: string | null = null;

    try {
      const response = await fetch(endpoint.url as string, {
        method: "POST",
        headers,
        body: payloadStr,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;

      if (response.ok) {
        newStatus = "delivered";
        deliveredAt = new Date().toISOString();
      } else if (DEAD_STATUS_CODES.includes(statusCode)) {
        newStatus = "dead";
      } else if (attemptCount >= MAX_RETRIES) {
        newStatus = "dead";
      } else {
        newStatus = "failed";
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (attemptCount >= MAX_RETRIES) {
        newStatus = "dead";
      } else {
        newStatus = "failed";
      }
    }

    await supabase
      .from("outbound_webhook_deliveries")
      .update({
        status: newStatus,
        attempt_count: attemptCount,
        last_attempt_at: now.toISOString(),
        delivered_at: deliveredAt,
        last_status_code: statusCode,
        last_error: lastError,
        next_attempt_at:
          newStatus === "failed"
            ? computeNextAttempt(attemptCount).toISOString()
            : now.toISOString(),
      })
      .eq("id", deliveryId);
  }
}

export async function listRecentDeliveries(
  limit = 50
): Promise<OutboundDeliveryDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("outbound_webhook_deliveries")
    .select(
      `
      id,
      event_id,
      endpoint_id,
      status,
      attempt_count,
      next_attempt_at,
      last_attempt_at,
      delivered_at,
      last_status_code,
      last_error,
      created_at,
      outbound_events (type),
      outbound_webhook_endpoints (name, url)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Falha ao listar entregas.");

  return (data ?? []).map((row) => {
    const event = row.outbound_events as unknown as Record<string, unknown> | null;
    const endpoint = row.outbound_webhook_endpoints as unknown as Record<
      string,
      unknown
    > | null;
    return {
      id: row.id as string,
      eventId: row.event_id as string,
      endpointId: row.endpoint_id as string,
      endpointName: (endpoint?.name as string) ?? "",
      endpointUrl: (endpoint?.url as string) ?? "",
      eventType: (event?.type as OutboundWebhookEventType) ?? "lead.abandoned",
      status: row.status as OutboundWebhookDeliveryStatus,
      attemptCount: row.attempt_count as number,
      nextAttemptAt: row.next_attempt_at as string,
      lastAttemptAt: (row.last_attempt_at as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      lastStatusCode: (row.last_status_code as number | null) ?? null,
      lastError: (row.last_error as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

export async function retryDelivery(deliveryId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("outbound_webhook_deliveries")
    .update({
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .in("status", ["failed", "dead"]);
}
