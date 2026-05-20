"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OrderChartRow } from "@/lib/admin/orders";
import type { LeadChartRow } from "@/lib/admin/leads";
import { formatSaoPauloDateKey } from "@/lib/timezone";

const PALETTE = [
  "#0077ff",
  "#818cf8",
  "#34d399",
  "#f59e0b",
  "#60a5fa",
  "#f87171",
  "#a78bfa",
  "#fb923c",
];

type OrderDimension = "product_name" | "utm_source" | "utm_medium" | "utm_content" | "payment_method" | "seller_slug";
type LeadDimension = "utm_source" | "utm_medium" | "utm_content" | "seller_slug";

const ORDER_DIMENSIONS: { key: OrderDimension; label: string }[] = [
  { key: "product_name", label: "PRODUTO" },
  { key: "utm_source", label: "UTM SOURCE" },
  { key: "utm_medium", label: "UTM MEDIUM" },
  { key: "utm_content", label: "UTM CONTENT" },
  { key: "payment_method", label: "MEIO PGTO" },
  { key: "seller_slug", label: "SRC" },
];

const LEAD_DIMENSIONS: { key: LeadDimension; label: string }[] = [
  { key: "utm_source", label: "UTM SOURCE" },
  { key: "utm_medium", label: "UTM MEDIUM" },
  { key: "utm_content", label: "UTM CONTENT" },
  { key: "seller_slug", label: "SRC" },
];

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function formatDateFull(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

type SegmentEntry = { count: number; revenue: number };

type ChartDatePoint = {
  date: string;
  [segment: string]: string | number;
};

// ---- Tooltip ----

type TooltipPayloadItem = {
  dataKey: string;
  value: number;
  color: string;
  payload: ChartDatePoint;
};

function OrdersTooltip({
  active,
  payload,
  label,
  segments,
  segmentRevenue,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  segments: string[];
  segmentRevenue: Record<string, Record<string, number>>;
}) {
  if (!active || !payload?.length || !label) return null;
  const dateLabel = formatDateFull(label);

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs max-w-[220px]"
      style={{
        background: "var(--admin-surface-elevated)",
        borderColor: "var(--admin-border)",
        color: "var(--admin-fg)",
      }}
    >
      <div className="font-semibold mb-2">{dateLabel}</div>
      {segments.map((seg, i) => {
        const count = payload.find((p) => p.dataKey === seg)?.value ?? 0;
        if (count === 0) return null;
        const revenue = segmentRevenue[label]?.[seg] ?? 0;
        return (
          <div key={seg} className="flex items-start gap-1.5 mb-1">
            <span
              className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <div className="min-w-0">
              <span className="font-medium truncate block">{seg || "(sem valor)"}</span>
              <span style={{ color: "var(--admin-muted)" }}>
                {count} {count === 1 ? "venda" : "vendas"} · {formatBRL(revenue)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadsTooltip({
  active,
  payload,
  label,
  segments,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  segments: string[];
}) {
  if (!active || !payload?.length || !label) return null;
  const dateLabel = formatDateFull(label);

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs max-w-[200px]"
      style={{
        background: "var(--admin-surface-elevated)",
        borderColor: "var(--admin-border)",
        color: "var(--admin-fg)",
      }}
    >
      <div className="font-semibold mb-2">{dateLabel}</div>
      {segments.map((seg, i) => {
        const count = payload.find((p) => p.dataKey === seg)?.value ?? 0;
        if (count === 0) return null;
        return (
          <div key={seg} className="flex items-start gap-1.5 mb-1">
            <span
              className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <div className="min-w-0">
              <span className="font-medium truncate block">{seg || "(sem valor)"}</span>
              <span style={{ color: "var(--admin-muted)" }}>
                {count} {count === 1 ? "lead" : "leads"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Orders chart ----

type OrdersChartProps = {
  title: string;
  rawOrders: OrderChartRow[];
};

export function OrdersDimensionChart({ title, rawOrders }: OrdersChartProps) {
  const [activeDimension, setActiveDimension] = useState<OrderDimension>("utm_source");
  const [filterValue, setFilterValue] = useState("");

  const allValues = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawOrders) {
      const v = row[activeDimension] ?? "";
      set.add(v);
    }
    return Array.from(set).sort();
  }, [rawOrders, activeDimension]);

  const filteredRows = useMemo(() => {
    if (!filterValue) return rawOrders;
    return rawOrders.filter((r) => (r[activeDimension] ?? "") === filterValue);
  }, [rawOrders, activeDimension, filterValue]);

  const { chartData, allSegments, revenueMap } = useMemo(() => {
    const byDate: Record<string, Record<string, SegmentEntry>> = {};

    for (const row of filteredRows) {
      const date = formatSaoPauloDateKey(row.paid_at);
      const seg = row[activeDimension] ?? "";
      if (!byDate[date]) byDate[date] = {};
      if (!byDate[date][seg]) byDate[date][seg] = { count: 0, revenue: 0 };
      byDate[date][seg].count += 1;
      byDate[date][seg].revenue += row.total_amount_cents;
    }

    const segSet = new Set<string>();
    for (const segs of Object.values(byDate)) {
      for (const seg of Object.keys(segs)) segSet.add(seg);
    }
    const allSegments = Array.from(segSet).sort();

    const revenueMap: Record<string, Record<string, number>> = {};
    const chartData: ChartDatePoint[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, segs]) => {
        revenueMap[date] = {};
        const point: ChartDatePoint = { date };
        for (const seg of allSegments) {
          point[seg] = segs[seg]?.count ?? 0;
          revenueMap[date][seg] = segs[seg]?.revenue ?? 0;
        }
        return point;
      });

    return { chartData, allSegments, revenueMap };
  }, [filteredRows, activeDimension]);

  return (
    <div>
      <div className="text-sm font-medium mb-3" style={{ color: "var(--admin-fg)" }}>
        {title}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="overflow-x-auto flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-1.5 whitespace-nowrap pb-1">
            {ORDER_DIMENSIONS.map((dim) => (
              <button
                key={dim.key}
                onClick={() => { setActiveDimension(dim.key); setFilterValue(""); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={{
                  background: activeDimension === dim.key ? "var(--admin-brand)" : "transparent",
                  borderColor: activeDimension === dim.key ? "var(--admin-brand)" : "var(--admin-border)",
                  color: activeDimension === dim.key ? "#fff" : "var(--admin-muted)",
                }}
              >
                {dim.label}
              </button>
            ))}
          </div>
        </div>
        <select
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="shrink-0 rounded-lg border px-2 py-1.5 text-xs"
          style={{
            background: "var(--admin-surface-elevated)",
            borderColor: "var(--admin-border)",
            color: "var(--admin-fg)",
            minWidth: 110,
          }}
        >
          <option value="">Todas ({allValues.length})</option>
          {allValues.map((v) => (
            <option key={v} value={v}>{v || "(sem valor)"}</option>
          ))}
        </select>
      </div>

      {chartData.length === 0 ? (
        <div
          className="h-[200px] md:h-[260px] flex items-center justify-center text-sm"
          style={{ color: "var(--admin-muted)" }}
        >
          Nenhum dado no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              content={
                <OrdersTooltip
                  segments={allSegments}
                  segmentRevenue={revenueMap}
                />
              }
              cursor={{ fill: "var(--admin-surface-elevated)" }}
            />
            {allSegments.map((seg, i) => (
              <Bar
                key={seg}
                dataKey={seg}
                stackId="a"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === allSegments.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ---- Leads chart ----

type LeadsChartProps = {
  title: string;
  rawLeads: LeadChartRow[];
};

export function LeadsDimensionChart({ title, rawLeads }: LeadsChartProps) {
  const [activeDimension, setActiveDimension] = useState<LeadDimension>("utm_source");
  const [filterValue, setFilterValue] = useState("");

  const allValues = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawLeads) {
      const v = row[activeDimension] ?? "";
      set.add(v);
    }
    return Array.from(set).sort();
  }, [rawLeads, activeDimension]);

  const filteredRows = useMemo(() => {
    if (!filterValue) return rawLeads;
    return rawLeads.filter((r) => (r[activeDimension] ?? "") === filterValue);
  }, [rawLeads, activeDimension, filterValue]);

  const { chartData, allSegments } = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};

    for (const row of filteredRows) {
      const date = formatSaoPauloDateKey(row.created_at);
      const seg = row[activeDimension] ?? "";
      if (!byDate[date]) byDate[date] = {};
      byDate[date][seg] = (byDate[date][seg] ?? 0) + 1;
    }

    const segSet = new Set<string>();
    for (const segs of Object.values(byDate)) {
      for (const seg of Object.keys(segs)) segSet.add(seg);
    }
    const allSegments = Array.from(segSet).sort();

    const chartData: ChartDatePoint[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, segs]) => {
        const point: ChartDatePoint = { date };
        for (const seg of allSegments) {
          point[seg] = segs[seg] ?? 0;
        }
        return point;
      });

    return { chartData, allSegments };
  }, [filteredRows, activeDimension]);

  return (
    <div>
      <div className="text-sm font-medium mb-3" style={{ color: "var(--admin-fg)" }}>
        {title}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="overflow-x-auto flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-1.5 whitespace-nowrap pb-1">
            {LEAD_DIMENSIONS.map((dim) => (
              <button
                key={dim.key}
                onClick={() => { setActiveDimension(dim.key); setFilterValue(""); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={{
                  background: activeDimension === dim.key ? "var(--admin-brand)" : "transparent",
                  borderColor: activeDimension === dim.key ? "var(--admin-brand)" : "var(--admin-border)",
                  color: activeDimension === dim.key ? "#fff" : "var(--admin-muted)",
                }}
              >
                {dim.label}
              </button>
            ))}
          </div>
        </div>
        <select
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="shrink-0 rounded-lg border px-2 py-1.5 text-xs"
          style={{
            background: "var(--admin-surface-elevated)",
            borderColor: "var(--admin-border)",
            color: "var(--admin-fg)",
            minWidth: 110,
          }}
        >
          <option value="">Todas ({allValues.length})</option>
          {allValues.map((v) => (
            <option key={v} value={v}>{v || "(sem valor)"}</option>
          ))}
        </select>
      </div>

      {chartData.length === 0 ? (
        <div
          className="h-[200px] md:h-[260px] flex items-center justify-center text-sm"
          style={{ color: "var(--admin-muted)" }}
        >
          Nenhum dado no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              content={<LeadsTooltip segments={allSegments} />}
              cursor={{ fill: "var(--admin-surface-elevated)" }}
            />
            {allSegments.map((seg, i) => (
              <Bar
                key={seg}
                dataKey={seg}
                stackId="a"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === allSegments.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
