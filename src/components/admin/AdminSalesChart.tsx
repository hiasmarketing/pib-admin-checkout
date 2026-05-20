"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DataPoint = { date: string; revenue: number; count: number };

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

type TooltipEntry = { value?: number; payload?: DataPoint };

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const revenue = payload[0]?.value ?? 0;
  const count = payload[0]?.payload?.count ?? 0;
  const [year, month, day] = (label ?? "").split("-");
  const fullDate = `${day}/${month}/${year}`;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        background: "var(--admin-surface-elevated)",
        borderColor: "var(--admin-border)",
        color: "var(--admin-fg)",
      }}
    >
      <div className="font-medium mb-1">{fullDate}</div>
      <div>{formatBRL(revenue)}</div>
      <div style={{ color: "var(--admin-muted)" }}>{count} {count === 1 ? "venda" : "vendas"}</div>
    </div>
  );
}

type Props = {
  data: DataPoint[];
};

export function AdminSalesChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => {
            if (v === 0) return "R$ 0";
            if (v >= 100000) return `R$ ${(v / 100000).toFixed(1)}k`;
            return `R$ ${(v / 100).toFixed(0)}`;
          }}
          tick={{ fontSize: 11, fill: "var(--admin-muted)" }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--admin-surface-elevated)" }} />
        <Bar dataKey="revenue" fill="#0077ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
