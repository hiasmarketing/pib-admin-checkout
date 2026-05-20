import { requireOperator } from "@/lib/admin/auth";
import { listSellers } from "@/lib/catalog/sellers";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import Link from "next/link";

export const metadata = { title: "Vendedores — Admin" };

export default async function SellersPage() {
  await requireOperator();
  const sellers = await listSellers();

  return (
    <div>
      <AdminPageHeader
        title="Vendedores"
        description="Gerencie vendedores habilitados"
        action={<AdminButton href="/admin/sellers/new">+ Novo vendedor</AdminButton>}
      />

      {sellers.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
          <p className="text-sm">Nenhum vendedor cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sellers.map((seller) => (
            <Link key={seller.id} href={`/admin/sellers/${seller.slug}`} className="block">
              <div
                className="rounded-xl border p-4 hover:border-[var(--admin-brand)]/30 transition-colors"
                style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" style={{ color: "var(--admin-fg)" }}>{seller.name}</span>
                      <AdminStatusChip status={seller.active ? "active" : "inactive"} />
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
                      /{seller.slug}
                      {seller.sellerId && ` · ID: ${seller.sellerId}`}
                      {seller.email && ` · ${seller.email}`}
                    </div>
                  </div>
                  <div className="text-xs flex-shrink-0" style={{ color: "var(--admin-muted)" }}>Editar →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
