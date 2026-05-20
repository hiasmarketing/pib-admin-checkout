import Link from "next/link";
import { requireOperator } from "@/lib/admin/auth";
import { listLeads } from "@/lib/admin/leads";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { LeadsFilters } from "@/components/admin/LeadsFilters";
import { formatSaoPauloDateTime } from "@/lib/timezone";

export const metadata = { title: "Leads — Admin" };

function formatDate(iso: string): string {
  return formatSaoPauloDateTime(iso);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; seller?: string; from?: string; to?: string }>;
}) {
  await requireOperator();

  const resolved = await searchParams;
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const q = resolved.q ?? "";
  const seller = resolved.seller ?? "";
  const from = resolved.from ?? "";
  const to = resolved.to ?? "";

  const { leads, total } = await listLeads({
    page,
    q: q || undefined,
    seller: seller || undefined,
    from: from || undefined,
    to: to || undefined,
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
    return `/admin/leads?${params.toString()}`;
  }

  return (
    <div>
      <AdminPageHeader
        title="Leads"
        description="Contatos captados pelo formulário"
      />

      <LeadsFilters
        defaultQ={q}
        defaultSeller={seller}
        defaultFrom={from}
        defaultTo={to}
      />

      <div className="text-xs mb-3" style={{ color: "var(--admin-muted)" }}>
        {total} lead{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
      </div>

      {leads.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl border text-sm"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          Nenhum lead encontrado
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--admin-border)" }}>
            <table className="w-full text-sm" aria-label="Lista de leads">
              <thead>
                <tr style={thStyle}>
                  <th scope="col" className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Contato</th>
                  <th scope="col" className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Data</th>
                  <th scope="col" className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium hidden md:table-cell">Vendedor</th>
                  <th scope="col" className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium hidden md:table-cell">Source</th>
                  <th scope="col" className="py-3 px-4 text-left text-xs uppercase tracking-wider font-medium">Converteu</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-t hover:bg-[var(--admin-surface-elevated)] transition-colors"
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    <td className="py-3 px-4">
                      <Link href={`/admin/leads/${lead.short_id}`} className="block">
                        <div className="font-medium" style={{ color: "var(--admin-fg)" }}>{lead.name}</div>
                        <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{lead.email}</div>
                        <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{lead.phone}</div>
                      </Link>
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--admin-muted)" }}>
                      <Link href={`/admin/leads/${lead.short_id}`} className="block">
                        {formatDate(lead.created_at)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell" style={{ color: "var(--admin-muted)" }}>
                      <Link href={`/admin/leads/${lead.short_id}`} className="block">
                        {lead.seller_name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell" style={{ color: "var(--admin-muted)" }}>
                      <Link href={`/admin/leads/${lead.short_id}`} className="block">
                        {lead.utm_source ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/admin/leads/${lead.short_id}`} className="block">
                        {lead.converted ? (
                          <AdminStatusChip status="paid" label="Sim" />
                        ) : (
                          <AdminStatusChip status="inactive" label="Não" />
                        )}
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
