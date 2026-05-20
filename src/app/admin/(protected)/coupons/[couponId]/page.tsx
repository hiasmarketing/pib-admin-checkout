import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getCoupon } from "@/lib/catalog/coupons";
import { listTurmas } from "@/lib/catalog/turmas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { CouponForm } from "../CouponForm";
import { updateCouponAction } from "../actions";
import type { ProductDTO } from "@/lib/catalog/types";

export const metadata = { title: "Editar Cupom — Admin" };

async function listAllProducts(): Promise<ProductDTO[]> {
  const { data } = await getSupabaseAdmin()
    .from("products")
    .select("id, turma_id, name, slug, description, unit_amount_cents, currency, max_quantity, active, is_default, installment_options, offer_metadata, created_at, updated_at")
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    turmaId: row.turma_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    unitAmountCents: row.unit_amount_cents as number,
    currency: row.currency as "brl",
    maxQuantity: row.max_quantity as number,
    active: row.active as boolean,
    isDefault: row.is_default as boolean,
    installmentOptions: row.installment_options as number[],
    offerMetadata: (row.offer_metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  })) as ProductDTO[];
}

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ couponId: string }>;
}) {
  await requireOperator();
  const { couponId } = await params;
  const [coupon, turmas, products] = await Promise.all([
    getCoupon(couponId),
    listTurmas(),
    listAllProducts(),
  ]);

  if (!coupon) notFound();

  const action = updateCouponAction.bind(null, couponId);

  return (
    <div>
      <AdminPageHeader
        title={`Editar: ${coupon.code}`}
        action={<AdminButton href="/admin/coupons" variant="secondary">← Voltar</AdminButton>}
      />
      <CouponForm
        defaultValues={coupon}
        turmas={turmas}
        products={products}
        action={action}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
