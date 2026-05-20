import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateCouponInput, ValidationError } from "./validation";
import type { CouponDTO, CouponInput } from "./types";

function mapRow(
  row: Record<string, unknown>,
  turmaIds: string[],
  productIds: string[]
): CouponDTO {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    discountType: row.discount_type as CouponDTO["discountType"],
    discountValue: row.discount_value as number,
    currency: row.currency as "brl",
    active: row.active as boolean,
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    maxRedemptions: (row.max_redemptions as number | null) ?? null,
    redeemedCount: row.redeemed_count as number,
    minimumSubtotalCents: (row.minimum_subtotal_cents as number | null) ?? null,
    maxDiscountCents: (row.max_discount_cents as number | null) ?? null,
    turmaIds,
    productIds,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function loadScopes(
  couponId: string
): Promise<{ turmaIds: string[]; productIds: string[] }> {
  const supabase = getSupabaseAdmin();

  const [turmasResult, productsResult] = await Promise.all([
    supabase
      .from("coupon_turmas")
      .select("turma_id")
      .eq("coupon_id", couponId),
    supabase
      .from("coupon_products")
      .select("product_id")
      .eq("coupon_id", couponId),
  ]);

  return {
    turmaIds: (turmasResult.data ?? []).map((r) => r.turma_id as string),
    productIds: (productsResult.data ?? []).map((r) => r.product_id as string),
  };
}

export async function listCoupons(): Promise<CouponDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Falha ao listar cupons.");

  const rows = data ?? [];
  const dtos = await Promise.all(
    rows.map(async (row) => {
      const { turmaIds, productIds } = await loadScopes(row.id as string);
      return mapRow(row, turmaIds, productIds);
    })
  );

  return dtos;
}

export async function getCoupon(id: string): Promise<CouponDTO | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("coupons")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Falha ao buscar cupom.");

  if (!data) return null;

  const { turmaIds, productIds } = await loadScopes(id);
  return mapRow(data, turmaIds, productIds);
}

async function upsertScopes(
  couponId: string,
  turmaIds: string[],
  productIds: string[]
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await Promise.all([
    supabase.from("coupon_turmas").delete().eq("coupon_id", couponId),
    supabase.from("coupon_products").delete().eq("coupon_id", couponId),
  ]);

  if (turmaIds.length > 0) {
    await supabase
      .from("coupon_turmas")
      .insert(turmaIds.map((turma_id) => ({ coupon_id: couponId, turma_id })));
  }

  if (productIds.length > 0) {
    await supabase
      .from("coupon_products")
      .insert(
        productIds.map((product_id) => ({ coupon_id: couponId, product_id }))
      );
  }
}

export async function createCoupon(input: CouponInput): Promise<CouponDTO> {
  validateCouponInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("coupons")
    .insert({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      currency: input.currency,
      active: input.active,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      max_redemptions: input.maxRedemptions ?? null,
      minimum_subtotal_cents: input.minimumSubtotalCents ?? null,
      max_discount_cents: input.maxDiscountCents ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError("code", "Código de cupom já existe.");
    }
    throw new Error("Falha ao criar cupom.");
  }

  await upsertScopes(data.id as string, input.turmaIds, input.productIds);

  return mapRow(data, input.turmaIds, input.productIds);
}

export async function updateCoupon(
  id: string,
  input: CouponInput
): Promise<CouponDTO> {
  validateCouponInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("coupons")
    .update({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      currency: input.currency,
      active: input.active,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      max_redemptions: input.maxRedemptions ?? null,
      minimum_subtotal_cents: input.minimumSubtotalCents ?? null,
      max_discount_cents: input.maxDiscountCents ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError("code", "Código de cupom já existe.");
    }
    throw new Error("Falha ao atualizar cupom.");
  }

  await upsertScopes(id, input.turmaIds, input.productIds);

  return mapRow(data, input.turmaIds, input.productIds);
}
