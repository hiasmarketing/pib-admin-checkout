import "server-only";

import {
  dateInputToSaoPauloEndIso,
  dateInputToSaoPauloStartIso,
  formatSaoPauloDateKey,
} from "@/lib/timezone";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLeadMetrics, periodToDates, type Period } from "./leads";

const PAGE_SIZE = 50;

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "payment_failed"
  | "canceled"
  | "expired";

export type OrderRow = {
  id: string;
  status: OrderStatus;
  payment_method: string;
  quantity: number;
  installment_count: number;
  total_amount_cents: number;
  currency: string;
  coupon_code_snapshot: string | null;
  turma_name: string | null;
  product_name: string | null;
  seller_name_snapshot: string | null;
  seller_slug_snapshot: string | null;
  cpf_cnpj: string | null;
  stripe_decline_code: string | null;
  stripe_failure_code: string | null;
  paid_at: string | null;
  created_at: string;
  lead_id: string;
  lead?: {
    name: string;
    email: string;
    phone: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
  };
};

export async function listOrders(params: {
  page?: number;
  q?: string;
  seller?: string;
  from?: string;
  to?: string;
  status?: string;
}): Promise<{ orders: OrderRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("orders")
    .select("*, lead:leads(name, email, phone)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const from = params.from ? dateInputToSaoPauloStartIso(params.from) : undefined;
  const to = params.to ? dateInputToSaoPauloEndIso(params.to) : undefined;
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  if (params.status && params.status !== "") {
    query = query.eq("status", params.status);
  }
  if (params.seller) {
    query = query.or(
      `seller_slug_snapshot.ilike.%${params.seller}%,seller_name_snapshot.ilike.%${params.seller}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error("Falha ao listar orders.");

  let orders = (data ?? []) as OrderRow[];

  if (params.q) {
    const q = params.q.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.lead?.name?.toLowerCase().includes(q) ||
        o.lead?.email?.toLowerCase().includes(q)
    );
  }

  return { orders, total: count ?? 0 };
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "*, lead:leads(name, email, phone, utm_source, utm_medium, utm_campaign, utm_content, utm_term)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar order.");
  return data as OrderRow | null;
}

export async function getOrderMetrics(period: Period): Promise<{
  totalPaid: number;
  revenue: number;
  conversionRate: number;
  ticketMedio: number;
}> {
  const { from, to } = periodToDates(period);
  const supabase = getSupabaseAdmin();

  let paidQuery = supabase
    .from("orders")
    .select("total_amount_cents, base_total_amount_cents")
    .eq("status", "paid");
  if (from) paidQuery = paidQuery.gte("created_at", from);
  if (to) paidQuery = paidQuery.lte("created_at", to);

  const [{ data: paidOrders, error: paidError }, { total: totalLeads }] =
    await Promise.all([paidQuery, getLeadMetrics(period)]);

  if (paidError) throw new Error("Falha ao buscar métricas de orders.");

  const rows = (paidOrders ?? []) as { total_amount_cents: number; base_total_amount_cents: number | null }[];
  const totalPaid = rows.length;
  const revenue = rows.reduce((sum, r) => sum + (r.base_total_amount_cents ?? r.total_amount_cents), 0);
  const conversionRate = totalLeads > 0 ? totalPaid / totalLeads : 0;
  const ticketMedio = totalPaid > 0 ? revenue / totalPaid : 0;

  return { totalPaid, revenue, conversionRate, ticketMedio };
}

export type OrderChartRow = {
  paid_at: string;
  total_amount_cents: number;
  payment_method: string;
  product_name: string | null;
  seller_slug: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
};

export async function getRawOrdersForChart(
  period: Period
): Promise<OrderChartRow[]> {
  const { from, to } = periodToDates(period);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("orders")
    .select(
      "paid_at, total_amount_cents, base_total_amount_cents, payment_method, product_name, lead:leads(utm_source, utm_medium, utm_content, seller_slug)"
    )
    .eq("status", "paid");
  if (from) query = query.gte("paid_at", from);
  if (to) query = query.lte("paid_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Falha ao buscar dados do gráfico UTM.");

  type RawRow = {
    paid_at: string | null;
    total_amount_cents: number;
    base_total_amount_cents: number | null;
    payment_method: string;
    product_name: string | null;
    lead: { utm_source: string | null; utm_medium: string | null; utm_content: string | null; seller_slug: string | null } | null;
  };
  const rows = (data ?? []) as unknown as RawRow[];

  return rows
    .filter((r) => r.paid_at != null)
    .map((r) => ({
      paid_at: r.paid_at as string,
      total_amount_cents: r.base_total_amount_cents ?? r.total_amount_cents,
      payment_method: r.payment_method,
      product_name: r.product_name,
      seller_slug: r.lead?.seller_slug ?? null,
      utm_source: r.lead?.utm_source ?? null,
      utm_medium: r.lead?.utm_medium ?? null,
      utm_content: r.lead?.utm_content ?? null,
    }));
}

export async function getOrdersDailyChart(
  period: Period
): Promise<Array<{ date: string; revenue: number; count: number }>> {
  const { from, to } = periodToDates(period);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("orders")
    .select("paid_at, total_amount_cents, base_total_amount_cents")
    .eq("status", "paid");
  if (from) query = query.gte("paid_at", from);
  if (to) query = query.lte("paid_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Falha ao buscar dados do gráfico.");

  const rows = (data ?? []) as { paid_at: string | null; total_amount_cents: number; base_total_amount_cents: number | null }[];

  const byDate: Record<string, { revenue: number; count: number }> = {};
  for (const row of rows) {
    if (!row.paid_at) continue;
    const date = formatSaoPauloDateKey(row.paid_at);
    if (!byDate[date]) byDate[date] = { revenue: 0, count: 0 };
    byDate[date].revenue += row.base_total_amount_cents ?? row.total_amount_cents;
    byDate[date].count += 1;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, count }]) => ({ date, revenue, count }));
}
