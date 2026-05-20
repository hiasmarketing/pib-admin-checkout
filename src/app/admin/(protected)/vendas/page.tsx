import Link from "next/link";
import { requireOperator } from "@/lib/admin/auth";
import { listOrders } from "@/lib/admin/orders";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { VendasFilters } from "@/components/admin/VendasFilters";
import { formatSaoPauloDateTime } from "@/lib/timezone";

export const metadata = { title: "Vendas — Admin" };

function formatDate(iso: string): string {
  return formatSaoPauloDateTime(iso);
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const STATUS_CHIP_MAP: Record<string, "paid" | "pending" | "failed" | "inactive"> = {
  paid: "paid",
  pending_payment: "pending",
  payment_failed: "failed",
  canceled: "inactive",
};

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; seller?: string; from?: string; to?: string; status?: string }>;
}) {
  await requireOperator();

  const resolved = await searchParams;
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const q = resolved.q ?? "";
  const seller = resolved.seller ?? "";
  const from = resolved.from ?? "";
  const to = resolved.to ?? "";
  const status = resolved.status ?? "";

  const { orders, total } = await listOrders({
    page,
    q: q || undefined,
    seller: seller || undefined,
    from: from || undefined,
    to: to || undefined,
    status: status || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const thStyle = {
    background: "var(--admin-surface-elevated)",
    color: "var(--admin-muted)",
  };

  function buildPageUrl(p: number): string {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (q) params.set("q", q);
    if (seller) params.set("seller", seller);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    return `/admin/vendas?${params.toString()}`;
  }

  return (
    <div>
      <AdminPageHeader
        title="Vendas"
        description="Pedidos realizados no checkout"
      />

      <VendasFilters
        defaultQ={q}
        defaultSeller={seller}
        defaultFrom={from}
        defaultTo={to}
        defaultStatus={status}
      />

      <div className="text-xs mb-3" style={{ color: "var(--admin-muted)" }}>
        {total} venda{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}
      </div>

      {orders.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl border text-sm"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          Nenhuma venda encontrada
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--admin-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={thStyle}>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Data</th>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Produto / Turma</th>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium hidden md:table-cell">Contato</th>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Vendedor</th>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Status</th>
                  <th className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t hover:bg-[var(--admin-surface-elevated)] transition-colors"
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    <td className="py-3 px-4" style={{ color: "var(--admin-muted)" }}>
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        {formatDate(order.created_at)}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        <div style={{ color: "var(--admin-fg)" }}>{order.product_name ?? "—"}</div>
                        {order.turma_name && (
                          <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{order.turma_name}</div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        <div style={{ color: "var(--admin-fg)" }}>{order.lead?.name ?? "—"}</div>
                        <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{order.lead?.email ?? ""}</div>
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell" style={{ color: "var(--admin-muted)" }}>
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        {order.seller_name_snapshot ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        <AdminStatusChip status={STATUS_CHIP_MAP[order.status] ?? "inactive"} />
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium" style={{ color: "var(--admin-fg)" }}>
                      <Link href={`/admin/vendas/${order.id}`} className="block">
                        {formatAmount(order.total_amount_cents)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              {page > 1 ? (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="text-sm px-3 py-2 rounded-lg border"
                  style={{ color: "var(--admin-fg)", borderColor: "var(--admin-border)" }}
                >
                  ← Anterior
                </Link>
              ) : (
                <span className="text-sm px-3 py-2 opacity-40" style={{ color: "var(--admin-muted)" }}>← Anterior</span>
              )}
              <span className="text-sm" style={{ color: "var(--admin-muted)" }}>
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="text-sm px-3 py-2 rounded-lg border"
                  style={{ color: "var(--admin-fg)", borderColor: "var(--admin-border)" }}
                >
                  Próxima →
                </Link>
              ) : (
                <span className="text-sm px-3 py-2 opacity-40" style={{ color: "var(--admin-muted)" }}>Próxima →</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
