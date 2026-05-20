"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { ADMIN_CACHE_TAGS } from "@/lib/admin/cache";
import { createSeller, updateSeller } from "@/lib/catalog/sellers";
import { ValidationError } from "@/lib/catalog/validation";
import type { SellerInput } from "@/lib/catalog/types";

function extractSellerInput(data: FormData): SellerInput {
  return {
    sellerId: (data.get("sellerId") as string) || null,
    slug: String(data.get("slug") ?? "").trim(),
    name: String(data.get("name") ?? "").trim(),
    email: (data.get("email") as string) || null,
    phone: (data.get("phone") as string) || null,
    active: data.get("active") === "1",
    turmaIds: data.getAll("turmaIds").filter(Boolean) as string[],
    productIds: data.getAll("productIds").filter(Boolean) as string[],
  };
}

export async function createSellerAction(
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string } } | void> {
  await requireOperator();

  let sellerSlug: string;
  try {
    const input = extractSellerInput(data);
    const seller = await createSeller(input);
    revalidatePath("/admin/sellers");
    revalidateTag(ADMIN_CACHE_TAGS.sellers, "default");
    sellerSlug = seller.slug;
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao criar vendedor." };
  }
  redirect(`/admin/sellers/${sellerSlug}`);
}

export async function updateSellerAction(
  sellerId: string,
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractSellerInput(data);
    const updated = await updateSeller(sellerId, input);
    revalidatePath("/admin/sellers");
    revalidatePath(`/admin/sellers/${updated.slug}`);
    revalidateTag(ADMIN_CACHE_TAGS.sellers, "default");
    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) return { error: err.message };
    return { error: "Erro ao atualizar vendedor." };
  }
}
