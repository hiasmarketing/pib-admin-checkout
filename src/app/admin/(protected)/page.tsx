import Link from "next/link";
import { requireOperator } from "@/lib/admin/auth";
import { getLeadMetrics, type Period } from "@/lib/admin/leads";
import { getOrderMetrics, getOrdersDailyChart } from "@/lib/admin/orders";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { MetricCard } from "@/components/admin/MetricCard";
import { PeriodSelector } from "@/components/admin/PeriodSelector";
import { AdminSalesChart } from "@/components/admin/AdminSalesChart";
import { OrdersDimensionChart, LeadsDimensionChart } from "@/components/admin/AdminDimensionChart";
import { getRawOrdersForChart } from "@/lib/admin/orders";
import { getRawLeadsForChart } from "@/lib/admin/leads";

const QUICK_LINKS = [
  { href: "/admin/turmas", label: "Turmas", description: "Gerenciar turmas e eventos" },
  { href: "/admin/coupons", label: "Cupons", description: "Criar e gerenciar descontos" },
  { href: "/admin/sellers", label: "Vendedores", description: "Controlar vendedores habilitados" },
  { href: "/admin/webhooks", label: "Webhooks", description: "Configurar integrações externas" },
];

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireOperator();

  const resolved = await searchParams;
  const period = (resolved.period ?? "30d") as Period;
  const periodLabel =
    period === "hoje" ? "hoje" :
    period === "7d" ? "últimos 7 dias" :
    period === "30d" ? "últimos 30 dias" : "todo o período";

  const [leadMetrics, orderMetrics, dailyChart, rawOrders, rawLeads] = await Promise.all([
    getLeadMetrics(period),
    getOrderMetrics(period),
    getOrdersDailyChart(period),
    getRawOrdersForChart(period),
    getRawLeadsForChart(period),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Painel de controle do PIB"
        action={<PeriodSelector />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Leads"
          value={String(leadMetrics.total)}
          sublabel={periodLabel}
        />
        <MetricCard
          label="Vendas pagas"
          value={String(orderMetrics.totalPaid)}
          sublabel={periodLabel}
          highlight
        />
        <MetricCard
          label="Receita"
          value={formatBRL(orderMetrics.revenue)}
          sublabel={periodLabel}
        />
        <MetricCard
          label="Conversão"
          value={`${(orderMetrics.conversionRate * 100).toFixed(1)}%`}
          sublabel={periodLabel}
        />
      </div>

      <AdminCard className="mb-6">
        <div
          className="text-sm font-medium mb-4"
          style={{ color: "var(--admin-fg)" }}
        >
          Receita por dia
        </div>
        {dailyChart.length === 0 ? (
          <div
            className="h-[260px] flex items-center justify-center text-sm"
            style={{ color: "var(--admin-muted)" }}
          >
            Nenhum dado no período
          </div>
        ) : (
          <AdminSalesChart data={dailyChart} />
        )}
      </AdminCard>

      <AdminCard className="mb-6">
        <OrdersDimensionChart title="Vendas por dia" rawOrders={rawOrders} />
      </AdminCard>

      <AdminCard className="mb-6">
        <LeadsDimensionChart title="Leads por dia" rawLeads={rawLeads} />
      </AdminCard>

      <div>
        <div
          className="text-sm font-medium mb-3"
          style={{ color: "var(--admin-muted)" }}
        >
          Acesso rápido
        </div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="block">
              <AdminCard className="hover:border-[var(--admin-brand)]/40 transition-colors">
                <div className="font-medium text-sm" style={{ color: "var(--admin-fg)" }}>
                  {link.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--admin-muted)" }}>
                  {link.description}
                </div>
              </AdminCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
