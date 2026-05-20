"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { ADMIN_CACHE_TAGS } from "@/lib/admin/cache";
import { createTurma, updateTurma } from "@/lib/catalog/turmas";
import { ValidationError } from "@/lib/catalog/validation";
import type { TurmaInput } from "@/lib/catalog/types";

function extractTurmaInput(data: FormData): TurmaInput {
  return {
    name: String(data.get("name") ?? "").trim(),
    slug: String(data.get("slug") ?? "").trim(),
    startsAt: (data.get("startsAt") as string) || null,
    endsAt: (data.get("endsAt") as string) || null,
    location: (data.get("location") as string) || null,
    whatsappGroupUrl: (data.get("whatsappGroupUrl") as string) || null,
    status: (data.get("status") as TurmaInput["status"]) ?? "draft",
  };
}

export async function createTurmaAction(
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string } } | void> {
  await requireOperator();

  let turmaSlug: string;
  try {
    const input = extractTurmaInput(data);
    const turma = await createTurma(input);
    turmaSlug = turma.slug;
    revalidatePath("/admin/turmas");
    revalidatePath("/api/catalog/options");
    revalidateTag(ADMIN_CACHE_TAGS.turmas, "default");
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao criar turma." };
  }
  redirect(`/admin/turmas/${turmaSlug}/products/new`);
}

export async function updateTurmaAction(
  id: string,
  data: FormData
): Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void> {
  await requireOperator();

  try {
    const input = extractTurmaInput(data);
    const updated = await updateTurma(id, input);
    revalidatePath("/admin/turmas");
    revalidatePath(`/admin/turmas/${updated.slug}`);
    revalidatePath("/api/catalog/options");
    revalidateTag(ADMIN_CACHE_TAGS.turmas, "default");
    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao atualizar turma." };
  }
}
