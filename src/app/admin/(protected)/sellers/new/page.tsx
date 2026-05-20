import { requireOperator } from "@/lib/admin/auth";
import { listTurmas } from "@/lib/catalog/turmas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { SellerForm } from "../SellerForm";
import { createSellerAction } from "../actions";
import type { ProductDTO } from "@/lib/catalog/types";

export const metadata = { title: "Novo Vendedor — Admin" };

async function listAllProducts(): Promise<ProductDTO[]> {
  const { data } = await getSupabaseAdmin()
    .from("products")
    .select("id, turma_id, name, slug, description, unit_amount_cents, currency, max_quantity, active, is_default, installment_options, offer_metadata, created_at, updated_at")
    .eq("active", true).order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string, turmaId: r.turma_id as string, name: r.name as string, slug: r.slug as string,
    description: r.description as string | null, unitAmountCents: r.unit_amount_cents as number,
    currency: r.currency as "brl", maxQuantity: r.max_quantity as number, active: r.active as boolean,
    isDefault: r.is_default as boolean, installmentOptions: r.installment_options as number[],
    offerMetadata: (r.offer_metadata as Record<string, unknown>) ?? {}, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  })) as ProductDTO[];
}

export default async function NewSellerPage() {
  await requireOperator();
  const [turmas, products] = await Promise.all([listTurmas(), listAllProducts()]);

  return (
    <div>
      <AdminPageHeader title="Novo Vendedor" action={<AdminButton href="/admin/sellers" variant="secondary">← Voltar</AdminButton>} />
      <SellerForm turmas={turmas} products={products} action={createSellerAction} submitLabel="Criar vendedor" />
    </div>
  );
}
