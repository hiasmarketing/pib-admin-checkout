"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import {
  createWebhookEndpoint,
  updateWebhookEndpoint,
  retryDelivery,
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

  let endpointId: string;
  try {
    const input = extractEndpointInput(data);
    const endpoint = await createWebhookEndpoint(input);
    revalidatePath("/admin/webhooks");
    endpointId = endpoint.id;
  } catch (err) {
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao criar endpoint." };
  }
  redirect(`/admin/webhooks/${endpointId}`);
}

export async function updateEndpointAction(
  endpointId: string,
  data: FormData
): Promise<{ error?: string; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractEndpointInput(data);
    await updateWebhookEndpoint(endpointId, input);
    revalidatePath("/admin/webhooks");
    revalidatePath(`/admin/webhooks/${endpointId}`);
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
