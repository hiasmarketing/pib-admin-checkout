"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { ADMIN_CACHE_TAGS } from "@/lib/admin/cache";
import {
  createWebhookEndpoint,
  updateWebhookEndpoint,
  retryDelivery,
  getWebhookEndpoint,
  type OutboundWebhookEventType,
} from "@/lib/webhooks/outbound";

function extractEndpointInput(data: FormData) {
  const events = data.getAll("subscribedEvents") as OutboundWebhookEventType[];
  return {
    name: String(data.get("name") ?? "").trim(),
    url: String(data.get("url") ?? "").trim(),
    active: data.get("active") === "1",
    subscribedEvents: events,
    secret: (data.get("secret") as string) || null,
  };
}

export async function createEndpointAction(
  data: FormData
): Promise<{ error?: string } | void> {
  await requireOperator();

  let shortId: string;
  try {
    const input = extractEndpointInput(data);
    const endpoint = await createWebhookEndpoint(input);
    revalidatePath("/admin/webhooks");
    revalidateTag(ADMIN_CACHE_TAGS.webhooks, "default");
    shortId = endpoint.shortId;
  } catch (err) {
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao criar endpoint." };
  }
  redirect(`/admin/webhooks/${shortId}`);
}

export async function updateEndpointAction(
  endpointId: string,
  data: FormData
): Promise<{ error?: string; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractEndpointInput(data);
    await updateWebhookEndpoint(endpointId, input);
    const endpoint = await getWebhookEndpoint(endpointId);
    revalidatePath("/admin/webhooks");
    if (endpoint) revalidatePath(`/admin/webhooks/${endpoint.shortId}`);
    revalidateTag(ADMIN_CACHE_TAGS.webhooks, "default");
    return { success: true };
  } catch (err) {
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao atualizar endpoint." };
  }
}

export async function retryDeliveryAction(deliveryId: string): Promise<{ success: boolean; error?: string }> {
  await requireOperator();
  try {
    await retryDelivery(deliveryId);
    revalidatePath("/admin/webhooks/deliveries");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao reenviar." };
  }
}
