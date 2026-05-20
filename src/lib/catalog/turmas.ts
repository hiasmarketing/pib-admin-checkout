import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_CACHE_TAGS, cachedAdminQuery } from "@/lib/admin/cache";
import { validateTurmaInput, ValidationError } from "./validation";
import type { TurmaDTO, TurmaInput } from "./types";

function mapRow(row: Record<string, unknown>): TurmaDTO {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    whatsappGroupUrl: (row.whatsapp_group_url as string | null) ?? null,
    status: row.status as TurmaDTO["status"],
    externalMetadata: (row.external_metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const listTurmas = cachedAdminQuery(
  async (): Promise<TurmaDTO[]> => {
    const { data, error } = await getSupabaseAdmin()
      .from("turmas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error("Falha ao listar turmas.");

    return (data ?? []).map(mapRow);
  },
  ["catalog", "turmas", "list"],
  [ADMIN_CACHE_TAGS.turmas],
);

export const getTurma = cachedAdminQuery(
  async (id: string): Promise<TurmaDTO | null> => {
    const { data, error } = await getSupabaseAdmin()
      .from("turmas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error("Falha ao buscar turma.");

    return data ? mapRow(data) : null;
  },
  ["catalog", "turmas", "byId"],
  [ADMIN_CACHE_TAGS.turmas],
);

export const getTurmaBySlug = cachedAdminQuery(
  async (slug: string): Promise<TurmaDTO | null> => {
    const { data, error } = await getSupabaseAdmin()
      .from("turmas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error("Falha ao buscar turma.");

    return data ? mapRow(data) : null;
  },
  ["catalog", "turmas", "bySlug"],
  [ADMIN_CACHE_TAGS.turmas],
);

export async function createTurma(input: TurmaInput): Promise<TurmaDTO> {
  validateTurmaInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("turmas")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      location: input.location?.trim() ?? null,
      whatsapp_group_url: input.whatsappGroupUrl?.trim() || null,
      status: input.status,
      external_metadata: input.externalMetadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError("slug", "Slug já existe. Escolha outro.");
    }
    throw new Error("Falha ao criar turma.");
  }

  return mapRow(data);
}

export async function updateTurma(
  id: string,
  input: TurmaInput
): Promise<TurmaDTO> {
  validateTurmaInput(input);

  const { data, error } = await getSupabaseAdmin()
    .from("turmas")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      location: input.location?.trim() ?? null,
      whatsapp_group_url: input.whatsappGroupUrl?.trim() || null,
      status: input.status,
      external_metadata: input.externalMetadata ?? {},
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ValidationError("slug", "Slug já existe. Escolha outro.");
    }
    throw new Error("Falha ao atualizar turma.");
  }

  return mapRow(data);
}
