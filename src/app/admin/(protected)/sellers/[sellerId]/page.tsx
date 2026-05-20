import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getSeller } from "@/lib/catalog/sellers";
import { listTurmas } from "@/lib/catalog/turmas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCheckoutOrigin } from "@/lib/public-urls";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { SellerForm } from "../SellerForm";
import { SellerLinkCard } from "../SellerLinkCard";
import { updateSellerAction } from "../actions";
import type { ProductDTO } from "@/lib/catalog/types";

export const metadata = { title: "Editar Vendedor — Admin" };

async function listAllProducts(): Promise<ProductDTO[]> {
  const { data } = await getSupabaseAdmin()
    .from("products")
    .select("id, turma_id, name, slug, description, unit_amount_cents, currency, max_quantity, active, is_default, installment_options, offer_metadata, created_at, updated_at")
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string, turmaId: r.turma_id as string, name: r.name as string, slug: r.slug as string,
    description: r.description as string | null, unitAmountCents: r.unit_amount_cents as number,
    currency: r.currency as "brl", maxQuantity: r.max_quantity as number, active: r.active as boolean,
    isDefault: r.is_default as boolean, installmentOptions: r.installment_options as number[],
    offerMetadata: (r.offer_metadata as Record<string, unknown>) ?? {}, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  })) as ProductDTO[];
}

export default async function EditSellerPage({ params }: { params: Promise<{ sellerId: string }> }) {
  await requireOperator();
  const { sellerId } = await params;
  const [seller, turmas, products] = await Promise.all([getSeller(sellerId), listTurmas(), listAllProducts()]);

  if (!seller) notFound();

  const action = updateSellerAction.bind(null, sellerId);
  const origin = getCheckoutOrigin();
  const sellerLink = `${origin}/formulario?seller_slug=${encodeURIComponent(seller.slug)}`;

  return (
    <div>
      <AdminPageHeader
        title={`Editar: ${seller.name}`}
        action={<AdminButton href="/admin/sellers" variant="secondary">← Voltar</AdminButton>}
      />
      <SellerLinkCard slug={seller.slug} href={sellerLink} />
      <SellerForm defaultValues={seller} turmas={turmas} products={products} action={action} submitLabel="Salvar alterações" />
    </div>
  );
}
