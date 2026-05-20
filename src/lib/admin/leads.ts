import "server-only";

import {
  dateInputToSaoPauloEndIso,
  dateInputToSaoPauloStartIso,
  getSaoPauloTodayRange,
} from "@/lib/timezone";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const PAGE_SIZE = 50;

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ref: string | null;
  seller_name: string | null;
  seller_slug: string | null;
  created_at: string;
};

export type Period = "hoje" | "7d" | "30d" | "all";

export function periodToDates(period: Period): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString();

  if (period === "all") return {};
  if (period === "hoje") {
    return getSaoPauloTodayRange(now);
  }
  const days = period === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to };
}

export async function listLeads(params: {
  page?: number;
  q?: string;
  seller?: string;
  from?: string;
  to?: string;
}): Promise<{ leads: (LeadRow & { converted: boolean })[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  }
  if (params.seller) {
    query = query.or(
      `seller_slug.ilike.%${params.seller}%,seller_name.ilike.%${params.seller}%`
    );
  }
  const from = params.from ? dateInputToSaoPauloStartIso(params.from) : undefined;
  const to = params.to ? dateInputToSaoPauloEndIso(params.to) : undefined;
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);

  const { data, error, count } = await query;
  if (error) throw new Error("Falha ao listar leads.");

  const leads = (data ?? []) as LeadRow[];

  if (leads.length === 0) {
    return { leads: [], total: count ?? 0 };
  }

  const leadIds = leads.map((l) => l.id);
  const { data: paidOrders, error: ordersError } = await supabase
    .from("orders")
    .select("lead_id")
    .in("lead_id", leadIds)
    .eq("status", "paid");

  if (ordersError) throw new Error("Falha ao verificar conversões.");

  const convertedSet = new Set((paidOrders ?? []).map((o) => o.lead_id as string));

  return {
    leads: leads.map((l) => ({ ...l, converted: convertedSet.has(l.id) })),
    total: count ?? 0,
  };
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar lead.");
  return data as LeadRow | null;
}

export type LeadChartRow = {
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  seller_slug: string | null;
};

export async function getRawLeadsForChart(
  period: Period
): Promise<LeadChartRow[]> {
  const { from, to } = periodToDates(period);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("leads")
    .select("created_at, utm_source, utm_medium, utm_content, seller_slug");
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Falha ao buscar dados de leads para gráfico.");

  return (data ?? []) as LeadChartRow[];
}

export async function getLeadMetrics(period: Period): Promise<{ total: number }> {
  const { from, to } = periodToDates(period);
  const supabase = getSupabaseAdmin();

  let query = supabase.from("leads").select("*", { count: "exact", head: true });
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { count, error } = await query;
  if (error) throw new Error("Falha ao buscar métricas de leads.");

  return { total: count ?? 0 };
}

export async function getLeadUtmPatterns(): Promise<{
  sources: string[];
  mediums: string[];
  campaigns: string[];
  contents: string[];
}> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("utm_source, utm_medium, utm_campaign, utm_content")
    .not("utm_source", "is", null);

  if (error) throw new Error("Falha ao buscar padrões UTM.");

  const rows = (data ?? []) as {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
  }[];

  function topFive(values: (string | null)[]): string[] {
    const freq: Record<string, number> = {};
    for (const v of values) {
      if (v) freq[v] = (freq[v] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
  }

  return {
    sources: topFive(rows.map((r) => r.utm_source)),
    mediums: topFive(rows.map((r) => r.utm_medium)),
    campaigns: topFive(rows.map((r) => r.utm_campaign)),
    contents: topFive(rows.map((r) => r.utm_content)),
  };
}
