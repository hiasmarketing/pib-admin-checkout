"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { createProduct, updateProduct } from "@/lib/catalog/products";
import { ValidationError } from "@/lib/catalog/validation";
import type {
  ProductInput,
  InstallmentCount,
  PaymentMethodType,
} from "@/lib/catalog/types";

function parseInstallmentRates(data: FormData): Record<string, number> {
  const raw = data.get("installmentRates");
  if (raw === null || raw === "") return {};

  if (typeof raw !== "string") {
    throw new ValidationError(
      "installmentRates",
      "Taxas de juros inválidas."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError(
      "installmentRates",
      "Taxas de juros devem estar em JSON válido."
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(
      "installmentRates",
      "Taxas de juros devem ser um objeto JSON."
    );
  }

  const result: Record<string, number> = {};
  for (const [installments, ratePct] of Object.entries(parsed)) {
    const normalizedRate = Number(ratePct);
    if (
      !Number.isInteger(Number(installments)) ||
      !Number.isFinite(normalizedRate) ||
      normalizedRate < 0 ||
      normalizedRate > 999.99
    ) {
      throw new ValidationError(
        "installmentRates",
        "Taxas de juros devem usar percentuais entre 0 e 999,99."
      );
    }
    result[installments] = normalizedRate;
  }

  return result;
}

function extractProductInput(data: FormData): ProductInput {
  const rawInstallments = data.getAll("installmentOptions").map(Number);
  const installmentOptions = rawInstallments.filter((n): n is InstallmentCount =>
    [1, 2, 3, 6, 12].includes(n)
  );
  const paymentMethods = data
    .getAll("paymentMethods")
    .filter(
      (method): method is PaymentMethodType =>
        method === "card" ||
        method === "pix" ||
        method === "klarna" ||
        method === "afterpay_clearpay"
    );

  return {
    turmaId: String(data.get("turmaId") ?? ""),
    name: String(data.get("name") ?? "").trim(),
    slug: String(data.get("slug") ?? "").trim(),
    description: (data.get("description") as string) || null,
    unitAmountCents: Number(data.get("unitAmountCents")),
    currency: (data.get("currency") as string) === "usd" ? "usd" : "brl",
    maxQuantity: Number(data.get("maxQuantity")),
    active: data.get("active") === "1",
    isDefault: data.get("isDefault") === "1",
    installmentOptions: installmentOptions.length > 0 ? installmentOptions : [1],
    paymentMethods: paymentMethods.length > 0 ? paymentMethods : ["card"],
    installmentRates: parseInstallmentRates(data),
  };
}

export async function createProductAction(
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string } } | void> {
  await requireOperator();

  let redirectPath: string;
  try {
    const input = extractProductInput(data);
    const product = await createProduct(input);
    revalidatePath(`/admin/turmas/${input.turmaId}`);
    redirectPath = `/admin/turmas/${input.turmaId}/products/${product.id}`;
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao criar produto." };
  }
  redirect(redirectPath);
}

export async function updateProductAction(
  productId: string,
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractProductInput(data);
    await updateProduct(productId, input);
    revalidatePath(`/admin/turmas/${input.turmaId}`);
    revalidatePath(`/admin/turmas/${input.turmaId}/products/${productId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao atualizar produto." };
  }
}
