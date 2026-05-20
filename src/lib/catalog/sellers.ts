import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateSellerInput, ValidationError } from "./validation";
import type { SellerDTO, SellerInput, ResolvedSeller } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRow(
  row: Record<string, unknown>,
  turmaIds: string[],
  productIds: string[]
): SellerDTO {
  return {
    id: row.id as string,
    sellerId: (row.seller_id as string | null) ?? null,
    slug: row.slug as string,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    active: row.active as boolean,
    externalMetadata: (row.external_metadata as Record<string, unknown>) ?? {},
    turmaIds,
    productIds,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function loadScopes(
  sellerId: string
): Promise<{ turmaIds: string[]; productIds: string[] }> {
  const supabase = getSupabaseAdmin();

  const [turmasResult, productsResult] = await Promise.all([
    supabase
      .from("seller_turmas")
      .select("turma_id")
      .eq("seller_id", sellerId),
    supabase
      .from("seller_products")
      .select("product_id")
      .eq("seller_id", sellerId),
  ]);

  return {
    turmaIds: (turmasResult.data ?? []).map((r) => r.turma_id as string),
    productIds: (productsResult.data ?? []).map((r) => r.product_id as string),
  };
}

export async function listSellers(): Promise<SellerDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Falha ao listar vendedores.");

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const { turmaIds, productIds } = await loadScopes(row.id as string);
      return mapRow(row, turmaIds, productIds);
    })
  );
}

export async function getSeller(id: string): Promise<SellerDTO | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar vendedor.");
  if (!data) return null;

  const { turmaIds, productIds } = await loadScopes(id);
  return mapRow(data, turmaIds, productIds);
}

async function upsertScopes(
  sellerId: string,
  turmaIds: string[],
  productIds: string[]
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await Promise.all([
    supabase.from("seller_turmas").delete().eq("seller_id", sellerId),
    supabase.from("seller_products").delete().eq("seller_id", sellerId),
  ]);

  if (turmaIds.length > 0) {
    await supabase
      .from("seller_turmas")
      .insert(turmaIds.map((turma_id) => ({ seller_id: sellerId, turma_id })));
  }

  if (productIds.length > 0) {
    await supabase
      .from("seller_products")
      .insert(
        productIds.map((product_id) => ({
          seller_id: sellerId,
          product_id,
        }))
      );
  }
}

export async function createSeller(input: SellerInput): Promise<SellerDTO> {
  validateSellerInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .insert({
      seller_id: input.sellerId?.trim() || null,
      slug: input.slug.trim(),
      name: input.name.trim(),
      email: input.email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      active: input.active,
      external_metadata: input.externalMetadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError(
        "slug",
        "Slug ou ID de vendedor já existe. Escolha outro."
      );
    }
    throw new Error("Falha ao criar vendedor.");
  }

  await upsertScopes(data.id as string, input.turmaIds, input.productIds);

  return mapRow(data, input.turmaIds, input.productIds);
}

export async function updateSeller(
  id: string,
  input: SellerInput
): Promise<SellerDTO> {
  validateSellerInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .update({
      seller_id: input.sellerId?.trim() || null,
      slug: input.slug.trim(),
      name: input.name.trim(),
      email: input.email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      active: input.active,
      external_metadata: input.externalMetadata ?? {},
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError(
        "slug",
        "Slug ou ID de vendedor já existe. Escolha outro."
      );
    }
    throw new Error("Falha ao atualizar vendedor.");
  }

  await upsertScopes(id, input.turmaIds, input.productIds);

  return mapRow(data, input.turmaIds, input.productIds);
}

export async function resolveSeller(params: {
  sellerId?: string | null;
  sellerSlug?: string | null;
  turmaId?: string;
  productId?: string;
}): Promise<ResolvedSeller | null> {
  if (!params.sellerId && !params.sellerSlug) return null;

  const supabase = getSupabaseAdmin();

  let data: Record<string, unknown> | null = null;
  let error: unknown = null;

  if (params.sellerId) {
    if (UUID_RE.test(params.sellerId)) {
      const internalResult = await supabase
        .from("sellers")
        .select("id, seller_id, slug, name, active")
        .eq("active", true)
        .eq("id", params.sellerId)
        .maybeSingle();

      data = internalResult.data;
      error = internalResult.error;
    }

    if (!data && !error) {
      const externalResult = await supabase
        .from("sellers")
        .select("id, seller_id, slug, name, active")
        .eq("active", true)
        .eq("seller_id", params.sellerId)
        .maybeSingle();

      data = externalResult.data;
      error = externalResult.error;
    }
  } else {
    const slugResult = await supabase
      .from("sellers")
      .select("id, seller_id, slug, name, active")
      .eq("active", true)
      .eq("slug", params.sellerSlug!)
      .maybeSingle();

    data = slugResult.data;
    error = slugResult.error;
  }

  if (error || !data) return null;

  const sellerId = data.id as string;

  // Check scope: if seller has explicit turma/product restrictions, validate them
  const [turmaScopes, productScopes] = await Promise.all([
    supabase
      .from("seller_turmas")
      .select("turma_id")
      .eq("seller_id", sellerId),
    supabase
      .from("seller_products")
      .select("product_id")
      .eq("seller_id", sellerId),
  ]);

  const turmaIds = (turmaScopes.data ?? []).map((r) => r.turma_id as string);
  const productIds = (productScopes.data ?? []).map(
    (r) => r.product_id as string
  );

  // If seller has scope restrictions, ensure the current turma/product is allowed
  if (turmaIds.length > 0 && params.turmaId) {
    if (!turmaIds.includes(params.turmaId)) return null;
  }

  if (productIds.length > 0 && params.productId) {
    if (!productIds.includes(params.productId)) return null;
  }

  return {
    id: sellerId,
    sellerId: (data.seller_id as string | null) ?? null,
    slug: data.slug as string,
    name: data.name as string,
    active: data.active as boolean,
  };
}
