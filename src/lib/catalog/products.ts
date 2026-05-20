import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_CACHE_TAGS, cachedAdminQuery } from "@/lib/admin/cache";
import { validateProductInput, ValidationError } from "./validation";
import type {
  ProductDTO,
  ProductInput,
  InstallmentCount,
  PaymentMethodType,
} from "./types";

function normalizePaymentMethods(value: unknown): PaymentMethodType[] {
  const methods = Array.isArray(value) ? value : ["card"];
  const normalized = methods.filter(
    (method): method is PaymentMethodType => method === "card" || method === "pix"
  );

  return normalized.length > 0 ? normalized : ["card"];
}

function normalizeInstallmentRates(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        Number.isInteger(Number(entry[0])) &&
        typeof entry[1] === "number" &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0 &&
        entry[1] <= 999.99
    )
  );
}

function mapRow(row: Record<string, unknown>): ProductDTO {
  return {
    id: row.id as string,
    turmaId: row.turma_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    unitAmountCents: row.unit_amount_cents as number,
    currency: "brl",
    maxQuantity: row.max_quantity as number,
    active: row.active as boolean,
    isDefault: row.is_default as boolean,
    installmentOptions: row.installment_options as InstallmentCount[],
    paymentMethods: normalizePaymentMethods(row.payment_methods),
    installmentRates: normalizeInstallmentRates(row.installment_rates),
    offerMetadata: (row.offer_metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const listProducts = cachedAdminQuery(
  async (turmaId: string): Promise<ProductDTO[]> => {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Falha ao listar produtos.");

    return (data ?? []).map(mapRow);
  },
  ["catalog", "products", "list"],
  [ADMIN_CACHE_TAGS.products],
);

export const getProduct = cachedAdminQuery(
  async (id: string): Promise<ProductDTO | null> => {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error("Falha ao buscar produto.");

    return data ? mapRow(data) : null;
  },
  ["catalog", "products", "byId"],
  [ADMIN_CACHE_TAGS.products],
);

export const getProductBySlug = cachedAdminQuery(
  async (turmaId: string, slug: string): Promise<ProductDTO | null> => {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("turma_id", turmaId)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error("Falha ao buscar produto.");

    return data ? mapRow(data) : null;
  },
  ["catalog", "products", "bySlug"],
  [ADMIN_CACHE_TAGS.products],
);

export async function createProduct(input: ProductInput): Promise<ProductDTO> {
  validateProductInput(input);

  const supabase = getSupabaseAdmin();

  if (input.isDefault && input.active) {
    await supabase
      .from("products")
      .update({ is_default: false })
      .eq("turma_id", input.turmaId)
      .eq("is_default", true)
      .eq("active", true);
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      turma_id: input.turmaId,
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      unit_amount_cents: input.unitAmountCents,
      currency: input.currency,
      max_quantity: input.maxQuantity,
      active: input.active,
      is_default: input.active ? input.isDefault : false,
      installment_options: input.installmentOptions,
      payment_methods: input.paymentMethods,
      installment_rates: input.installmentRates ?? {},
      offer_metadata: input.offerMetadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError(
        "slug",
        "Slug já existe para esta turma. Escolha outro."
      );
    }
    throw new Error("Falha ao criar produto.");
  }

  return mapRow(data);
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ProductDTO> {
  validateProductInput(input);

  const supabase = getSupabaseAdmin();

  if (input.isDefault && input.active) {
    await supabase
      .from("products")
      .update({ is_default: false })
      .eq("turma_id", input.turmaId)
      .eq("is_default", true)
      .eq("active", true)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      unit_amount_cents: input.unitAmountCents,
      currency: input.currency,
      max_quantity: input.maxQuantity,
      active: input.active,
      is_default: input.active ? input.isDefault : false,
      installment_options: input.installmentOptions,
      payment_methods: input.paymentMethods,
      installment_rates: input.installmentRates ?? {},
      offer_metadata: input.offerMetadata ?? {},
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError(
        "slug",
        "Slug já existe para esta turma. Escolha outro."
      );
    }
    throw new Error("Falha ao atualizar produto.");
  }

  return mapRow(data);
}
