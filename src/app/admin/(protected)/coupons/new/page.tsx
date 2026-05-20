import { requireOperator } from "@/lib/admin/auth";
import { listTurmas } from "@/lib/catalog/turmas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { CouponForm } from "../CouponForm";
import { createCouponAction } from "../actions";
import type { ProductDTO } from "@/lib/catalog/types";

export const metadata = { title: "Novo Cupom — Admin" };

async function listAllProducts(): Promise<ProductDTO[]> {
  const { data } = await getSupabaseAdmin()
    .from("products")
    .select("id, turma_id, name, slug, description, unit_amount_cents, currency, max_quantity, active, is_default, installment_options, offer_metadata, created_at, updated_at")
    .eq("active", true)
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

export default async function NewCouponPage() {
  await requireOperator();
  const [turmas, products] = await Promise.all([listTurmas(), listAllProducts()]);

  return (
    <div>
      <AdminPageHeader
        title="Novo Cupom"
        action={<AdminButton href="/admin/coupons" variant="secondary">← Voltar</AdminButton>}
      />
      <CouponForm turmas={turmas} products={products} action={createCouponAction} submitLabel="Criar cupom" />
    </div>
  );
}
