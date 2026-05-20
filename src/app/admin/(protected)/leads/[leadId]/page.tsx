import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOperator } from "@/lib/admin/auth";
import { getLead } from "@/lib/admin/leads";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { formatSaoPauloDateTime } from "@/lib/timezone";

function formatDate(iso: string): string {
  return formatSaoPauloDateTime(iso);
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>
        {label}
      </div>
      <div className="text-sm" style={{ color: value ? "var(--admin-fg)" : "var(--admin-muted)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

type OrderRowSimple = {
  id: string;
  status: string;
  total_amount_cents: number;
  product_name: string | null;
  created_at: string;
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requireOperator();

  const { leadId } = await params;
  const lead = await getLead(leadId);
  if (!lead) notFound();

  const { data: ordersData } = await getSupabaseAdmin()
    .from("orders")
    .select("id, status, total_amount_cents, product_name, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const orders = (ordersData ?? []) as OrderRowSimple[];

  const statusMap: Record<string, "paid" | "pending" | "failed" | "inactive"> = {
    paid: "paid",
    pending_payment: "pending",
    payment_failed: "failed",
    canceled: "inactive",
  };

  return (
    <div>
      <div className="mb-4">
        <AdminButton href="/admin/leads" variant="secondary">
          ← Leads
        </AdminButton>
      </div>

      <AdminPageHeader title={lead.name} />

      <div className="space-y-4">
        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>
            Informações
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="E-mail" value={lead.email} />
            <InfoRow label="Telefone" value={lead.phone} />
            <InfoRow label="Data de entrada" value={formatDate(lead.created_at)} />
            <InfoRow label="Vendedor" value={lead.seller_name} />
            <InfoRow label="Ref" value={lead.ref} />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>
            UTMs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Source" value={lead.utm_source} />
            <InfoRow label="Medium" value={lead.utm_medium} />
            <InfoRow label="Campaign" value={lead.utm_campaign} />
            <InfoRow label="Content" value={lead.utm_content} />
            <InfoRow label="Term" value={lead.utm_term} />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>
            Pedidos
          </div>
          {orders.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--admin-muted)" }}>
              Nenhum pedido encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/vendas/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-[var(--admin-brand)]/30 transition-colors"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <AdminStatusChip status={statusMap[order.status] ?? "inactive"} />
                    <span className="text-sm" style={{ color: "var(--admin-fg)" }}>
                      {order.product_name ?? "Produto"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: "var(--admin-fg)" }}>
                      {formatBRL(order.total_amount_cents)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
