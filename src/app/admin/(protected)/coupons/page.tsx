import { requireOperator } from "@/lib/admin/auth";
import { listCoupons } from "@/lib/catalog/coupons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import Link from "next/link";

export const metadata = { title: "Cupons — Admin" };

export default async function CouponsPage() {
  await requireOperator();
  const coupons = await listCoupons();

  return (
    <div>
      <AdminPageHeader
        title="Cupons"
        description="Gerencie cupons de desconto"
        action={<AdminButton href="/admin/coupons/new">+ Novo cupom</AdminButton>}
      />

      {coupons.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
          <p className="text-sm">Nenhum cupom cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => (
            <Link key={coupon.id} href={`/admin/coupons/${coupon.id}`} className="block">
              <div
                className="rounded-xl border p-4 hover:border-[var(--admin-brand)]/30 transition-colors"
                style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium" style={{ color: "var(--admin-brand)" }}>
                        {coupon.code}
                      </span>
                      <AdminStatusChip status={coupon.active ? "active" : "inactive"} />
                      {coupon.endsAt && new Date(coupon.endsAt) < new Date() && (
                        <AdminStatusChip status="expired" />
                      )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
                      {coupon.name} ·{" "}
                      {coupon.discountType === "percent"
                        ? `${coupon.discountValue}%`
                        : `R$ ${(coupon.discountValue / 100).toFixed(2)}`}{" "}
                      de desconto
                      {coupon.maxRedemptions !== null && ` · ${coupon.redeemedCount}/${coupon.maxRedemptions} usos`}
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
