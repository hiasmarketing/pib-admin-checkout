import "server-only";

import { pipedriveClient } from "@/lib/pipedrive/client";
import { getPipedriveConfig } from "@/lib/pipedrive/config";
import type {
  PipedriveDealInput,
  PipedriveLeadInput,
  PipedrivePersonInput,
} from "@/lib/pipedrive/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type LeadRow = Record<string, unknown>;
type OrderRow = Record<string, unknown> & { leads?: LeadRow | LeadRow[] | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractNumberId(value: unknown): number {
  const record = asRecord(value);
  const id = record?.id;
  const parsed = typeof id === "number" ? id : Number(id);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Resposta Pipedrive sem ID numérico.");
  }

  return parsed;
}

function extractUuid(value: unknown): string {
  const record = asRecord(value);
  const id = typeof record?.id === "string" ? record.id : "";

  if (!id) {
    throw new Error("Resposta Pipedrive sem ID de lead.");
  }

  return id;
}

function extractFirstProductId(searchResult: unknown): number | null {
  const result = asRecord(searchResult);
  const data = asRecord(result?.data) ?? result;
  const items = Array.isArray(data?.items) ? data.items : [];
  const first = asRecord(items[0]);
  const item = asRecord(first?.item) ?? first;
  const id = item?.id;
  const parsed = typeof id === "number" ? id : Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractFirstPersonId(searchResult: unknown): number | null {
  const result = asRecord(searchResult);
  const data = asRecord(result?.data) ?? result;
  const items = Array.isArray(data?.items) ? data.items : [];
  const first = asRecord(items[0]);
  const item = asRecord(first?.item) ?? first;
  const id = item?.id;
  const parsed = typeof id === "number" ? id : Number(id);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function firstNestedLead(order: OrderRow): LeadRow {
  const nested = Array.isArray(order.leads) ? order.leads[0] : order.leads;
  if (!nested) throw new Error("Pedido sem lead associado.");
  return nested;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function amountFromCents(value: unknown): number {
  const cents = optionalNumber(value) ?? 0;
  return Number((cents / 100).toFixed(2));
}

function unitPriceFromCents(totalCents: unknown, qty: unknown): number {
  const total = optionalNumber(totalCents) ?? 0;
  const quantity = Math.max(optionalNumber(qty) ?? 1, 1);
  return Number((total / 100 / quantity).toFixed(2));
}

type FieldValue = string | number | (string | number)[] | null;

function mapConfiguredFields(
  values: Record<string, FieldValue>
): Record<string, FieldValue> {
  const { customFields } = getPipedriveConfig();
  const mapped: Record<string, FieldValue> = {};

  for (const [localKey, pipedriveKey] of Object.entries(customFields)) {
    const value = values[localKey];
    if (value !== undefined && value !== null && value !== "") {
      mapped[pipedriveKey] = value;
    }
  }

  return mapped;
}

function mapPaymentMethodOption(order: OrderRow): string | number | null {
  const paymentMethod = optionalString(order.payment_method);
  if (!paymentMethod) return null;

  const { paymentMethodOptionMap } = getPipedriveConfig();
  return paymentMethodOptionMap[paymentMethod] ?? paymentMethod;
}

function mapLeadCustomFields(lead: LeadRow) {
  return mapConfiguredFields({
    lead_id: optionalString(lead.id),
    utm_source: optionalString(lead.utm_source),
    utm_medium: optionalString(lead.utm_medium),
    utm_campaign: optionalString(lead.utm_campaign),
    utm_content: optionalString(lead.utm_content),
    utm_term: optionalString(lead.utm_term),
    ref: optionalString(lead.ref),
    seller_id: optionalString(lead.seller_id),
    seller_slug: optionalString(lead.seller_slug),
    seller_name: optionalString(lead.seller_name),
  });
}

function mapOrderCustomFields(order: OrderRow) {
  const paymentMethodOption = mapPaymentMethodOption(order);
  return mapConfiguredFields({
    order_id: optionalString(order.id),
    lead_id: optionalString(order.lead_id),
    status: optionalString(order.status),
    turma_id: optionalString(order.turma_id),
    turma_name: optionalString(order.turma_name),
    product_id: optionalString(order.product_id),
    product_name: optionalString(order.product_name),
    product_slug: optionalString(order.product_slug),
    quantity: order.quantity != null ? String(order.quantity) : null,
    payment_method: paymentMethodOption != null ? [paymentMethodOption] : null,
    installment_count: optionalNumber(order.installment_count),
    coupon_code: optionalString(order.coupon_code_snapshot) ?? optionalString(order.coupon_code),
    seller_id: optionalString(order.seller_id_snapshot),
    seller_slug: optionalString(order.seller_slug_snapshot),
    seller_name: optionalString(order.seller_name_snapshot),
    subtotal_amount_cents: optionalNumber(order.subtotal_amount_cents),
    discount_amount_cents: optionalNumber(order.discount_amount_cents),
    total_amount_cents: optionalNumber(order.total_amount_cents),
    currency: optionalString(order.currency),
    cpf_cnpj: optionalString(order.cpf_cnpj),
    paid_at: optionalString(order.paid_at),
  });
}

function buildPersonPayload(input: PipedrivePersonInput) {
  return {
    name: input.name,
    owner_id: input.ownerId ?? undefined,
    emails: [{ value: input.email, primary: true, label: "work" }],
    phones: input.phone
      ? [{ value: input.phone, primary: true, label: "mobile" }]
      : undefined,
  };
}

function buildLeadPayload(input: PipedriveLeadInput) {
  return {
    title: input.title,
    person_id: input.personId,
    owner_id: input.ownerId ?? undefined,
    value: input.value ?? undefined,
    label_ids: input.labelIds && input.labelIds.length > 0 ? input.labelIds : undefined,
    ...input.customFields,
  };
}

function buildDealPayload(input: PipedriveDealInput) {
  return {
    title: input.title,
    person_id: input.personId,
    value: input.value,
    currency: input.currency,
    pipeline_id: input.pipelineId ?? undefined,
    stage_id: input.stageId ?? undefined,
    owner_id: input.ownerId ?? undefined,
    status: input.status ?? "open",
    custom_fields: input.customFields,
  };
}

async function loadLead(leadId: string): Promise<LeadRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error || !data) {
    throw new Error("Lead não encontrado para sync Pipedrive.");
  }

  return data;
}

async function loadOrderWithLead(orderId: string): Promise<OrderRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("*, leads (*)")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error("Pedido não encontrado para sync Pipedrive.");
  }

  return data as OrderRow;
}

async function findOrCreateProduct(name: string): Promise<number> {
  const search = await pipedriveClient.searchProducts(name);
  const existingId = extractFirstProductId(search);
  if (existingId) return existingId;
  return extractNumberId(await pipedriveClient.createProduct({ name }));
}

async function ensureProductOnDeal(
  dealId: number,
  productId: number,
  options: { itemPrice: number; quantity: number; currency: string }
): Promise<void> {
  const existing = await pipedriveClient.getDealProducts(dealId);
  const items = Array.isArray(existing) ? existing : [];
  const alreadyAdded = items.some((item) => {
    const r = asRecord(item);
    const pid = r?.product_id;
    return (typeof pid === "number" ? pid : Number(pid)) === productId;
  });
  if (alreadyAdded) return;
  await pipedriveClient.addProductToDeal(dealId, {
    product_id: productId,
    item_price: options.itemPrice,
    quantity: options.quantity,
    currency: options.currency,
  });
}

async function findOrCreatePerson(input: PipedrivePersonInput): Promise<number> {
  const search = await pipedriveClient.searchPersons(input.email);
  const existingId = extractFirstPersonId(search);

  if (existingId) {
    return existingId;
  }

  const payload = buildPersonPayload(input);
  return extractNumberId(await pipedriveClient.createPerson(payload));
}

async function hasPaidOrderForLead(leadId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Falha ao verificar compra paga do lead.");

  return !!data;
}

async function createLead(input: PipedriveLeadInput): Promise<string> {
  return extractUuid(await pipedriveClient.createLead(buildLeadPayload(input)));
}

async function createDeal(input: PipedriveDealInput): Promise<number> {
  return extractNumberId(await pipedriveClient.createDeal(buildDealPayload(input)));
}

async function markLeadSynced(
  leadId: string,
  values: { personId: number; pipedriveLeadId: string }
) {
  const { error } = await getSupabaseAdmin()
    .from("leads")
    .update({
      pipedrive_person_id: values.personId,
      pipedrive_lead_id: values.pipedriveLeadId,
      pipedrive_synced_at: new Date().toISOString(),
      pipedrive_sync_error: null,
    })
    .eq("id", leadId);

  if (error) throw new Error("Falha ao marcar lead sincronizado.");
}

async function markLeadPersonSynced(leadId: string, personId: number) {
  const { error } = await getSupabaseAdmin()
    .from("leads")
    .update({
      pipedrive_person_id: personId,
      pipedrive_sync_error: null,
    })
    .eq("id", leadId);

  if (error) throw new Error("Falha ao marcar pessoa Pipedrive do lead.");
}

async function markOrderSynced(
  orderId: string,
  values: { dealId: number; pipedriveLeadId?: string | null }
) {
  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      pipedrive_deal_id: values.dealId,
      pipedrive_lead_id: values.pipedriveLeadId ?? null,
      pipedrive_synced_at: new Date().toISOString(),
      pipedrive_sync_error: null,
    })
    .eq("id", orderId);

  if (error) throw new Error("Falha ao marcar pedido sincronizado.");
}

async function ensurePersonForLead(lead: LeadRow, ownerId: number | null): Promise<number> {
  const existingId = optionalNumber(lead.pipedrive_person_id);
  if (existingId) return existingId;

  const leadId = optionalString(lead.id);
  if (!leadId) throw new Error("Lead sem ID para sync Pipedrive.");

  const personId = await findOrCreatePerson({
    name: optionalString(lead.name) ?? "Cliente",
    email: optionalString(lead.email) ?? "",
    phone: optionalString(lead.phone),
    ownerId,
  });

  await markLeadPersonSynced(leadId, personId);
  return personId;
}

async function createOrderDeal(
  order: OrderRow,
  options: { stageId: number | null; status: "open" | "won" | "lost" }
): Promise<number> {
  const lead = firstNestedLead(order);
  const config = getPipedriveConfig();
  const personId = await ensurePersonForLead(lead, config.ownerId);
  const title = `${optionalString(lead.name) ?? "Cliente"} deal`;
  const currency = (optionalString(order.currency) ?? "brl").toUpperCase();

  const dealId = await createDeal({
    title,
    personId,
    value: amountFromCents(order.total_amount_cents),
    currency,
    pipelineId: config.pipelineId,
    stageId: options.stageId,
    ownerId: config.ownerId,
    status: options.status,
    customFields: mapOrderCustomFields(order),
  });

  const turmaName = optionalString(order.turma_name);
  if (turmaName) {
    const productId = await findOrCreateProduct(turmaName);
    await pipedriveClient.addProductToDeal(dealId, {
      product_id: productId,
      item_price: unitPriceFromCents(order.total_amount_cents, order.quantity),
      quantity: optionalNumber(order.quantity) ?? 1,
      currency,
    });
  }

  return dealId;
}

async function syncOrderAndReturnDealId(
  orderId: string,
  options: { stageId: number | null; status: "open" | "won" | "lost" }
): Promise<number> {
  await syncOrderToPipedrive(orderId);
  const order = await loadOrderWithLead(orderId);
  const existingId = optionalNumber(order.pipedrive_deal_id);

  return existingId ?? createOrderDeal(order, options);
}

export async function syncLeadToPipedrive(leadId: string): Promise<void> {
  const lead = await loadLead(leadId);
  const config = getPipedriveConfig();
  if (await hasPaidOrderForLead(leadId)) return;

  const personId =
    optionalNumber(lead.pipedrive_person_id) ??
    (await ensurePersonForLead(lead, config.ownerId));

  const pipedriveLeadId =
    optionalString(lead.pipedrive_lead_id) ??
    (await createLead({
      title: optionalString(lead.name) ?? "Cliente",
      personId,
      ownerId: config.ownerId,
      labelIds: config.leadLabelIds,
      customFields: mapLeadCustomFields(lead),
    }));

  await markLeadSynced(leadId, { personId, pipedriveLeadId });
}

export async function syncOrderToPipedrive(orderId: string): Promise<void> {
  const refreshed = await loadOrderWithLead(orderId);
  const lead = firstNestedLead(refreshed);
  const dealId =
    optionalNumber(refreshed.pipedrive_deal_id) ??
    (await createOrderDeal(refreshed, {
      stageId: getPipedriveConfig().pendingStageId,
      status: "open",
    }));

  await markOrderSynced(orderId, {
    dealId,
    pipedriveLeadId: optionalString(lead.pipedrive_lead_id),
  });
}

export async function syncPaidOrderToPipedrive(orderId: string): Promise<void> {
  const order = await loadOrderWithLead(orderId);
  const config = getPipedriveConfig();
  const dealId =
    optionalNumber(order.pipedrive_deal_id) ??
    (await syncOrderAndReturnDealId(orderId, {
      stageId: config.paidStageId,
      status: "won",
    }));

  await pipedriveClient.updateDeal(dealId, {
    status: "won",
    stage_id: config.paidStageId ?? undefined,
    custom_fields: mapOrderCustomFields(order),
  });

  const turmaName = optionalString(order.turma_name);
  if (turmaName) {
    const productId = await findOrCreateProduct(turmaName);
    await ensureProductOnDeal(dealId, productId, {
      itemPrice: unitPriceFromCents(order.total_amount_cents, order.quantity),
      quantity: optionalNumber(order.quantity) ?? 1,
      currency: (optionalString(order.currency) ?? "brl").toUpperCase(),
    });
  }

  await markOrderSynced(orderId, {
    dealId,
    pipedriveLeadId: optionalString(firstNestedLead(order).pipedrive_lead_id),
  });
}

export async function syncFailedOrderToPipedrive(orderId: string): Promise<void> {
  const order = await loadOrderWithLead(orderId);
  const config = getPipedriveConfig();
  const dealId =
    optionalNumber(order.pipedrive_deal_id) ??
    (await syncOrderAndReturnDealId(orderId, {
      stageId: config.failedStageId,
      status: "open",
    }));

  await pipedriveClient.updateDeal(dealId, {
    status: "open",
    stage_id: config.failedStageId ?? undefined,
    custom_fields: mapOrderCustomFields(order),
  });

  await markOrderSynced(orderId, {
    dealId,
    pipedriveLeadId: optionalString(firstNestedLead(order).pipedrive_lead_id),
  });
}
