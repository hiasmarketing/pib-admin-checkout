"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { createCoupon, updateCoupon } from "@/lib/catalog/coupons";
import { ValidationError } from "@/lib/catalog/validation";
import type { CouponInput } from "@/lib/catalog/types";

function extractCouponInput(data: FormData): CouponInput {
  return {
    code: String(data.get("code") ?? "").trim().toUpperCase(),
    name: String(data.get("name") ?? "").trim(),
    description: (data.get("description") as string) || null,
    discountType: (data.get("discountType") as CouponInput["discountType"]) ?? "percent",
    discountValue: Number(data.get("discountValue")),
    currency: "brl",
    active: data.get("active") === "1",
    startsAt: (data.get("startsAt") as string) || null,
    endsAt: (data.get("endsAt") as string) || null,
    maxRedemptions: data.get("maxRedemptions") ? Number(data.get("maxRedemptions")) : null,
    minimumSubtotalCents: data.get("minimumSubtotalCents") ? Number(data.get("minimumSubtotalCents")) : null,
    maxDiscountCents: data.get("maxDiscountCents") ? Number(data.get("maxDiscountCents")) : null,
    turmaIds: data.getAll("turmaIds").filter(Boolean) as string[],
    productIds: data.getAll("productIds").filter(Boolean) as string[],
  };
}

export async function createCouponAction(
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string } } | void> {
  await requireOperator();

  let couponId: string;
  try {
    const input = extractCouponInput(data);
    const coupon = await createCoupon(input);
    revalidatePath("/admin/coupons");
    couponId = coupon.id;
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao criar cupom." };
  }
  redirect(`/admin/coupons/${couponId}`);
}

export async function updateCouponAction(
  couponId: string,
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractCouponInput(data);
    await updateCoupon(couponId, input);
    revalidatePath("/admin/coupons");
    revalidatePath(`/admin/coupons/${couponId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao atualizar cupom." };
  }
}
