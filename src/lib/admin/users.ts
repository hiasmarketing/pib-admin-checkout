import "server-only";

import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin/auth";

export interface AdminUserDTO {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  role: AdminRole;
}

export interface CreateAdminUserResult {
  user: AdminUserDTO;
  initialPassword: string;
}

interface AdminUserRow {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export class AdminUserValidationError extends Error {
  constructor(
    public field: "name" | "email" | "role",
    message: string
  ) {
    super(message);
    this.name = "AdminUserValidationError";
  }
}

export class AdminUserConflictError extends Error {
  constructor(message = "Email já cadastrado.") {
    super(message);
    this.name = "AdminUserConflictError";
  }
}

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function mapAdminUser(row: AdminUserRow): AdminUserDTO {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInitialPassword(length = 16): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length]).join("");
}

function validateCreateInput(input: CreateAdminUserInput): {
  name: string;
  email: string;
  role: AdminRole;
} {
  const name = input.name.trim();
  const email = normalizeAdminEmail(input.email);
  const role = input.role;

  if (!name) {
    throw new AdminUserValidationError("name", "Informe o nome.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminUserValidationError("email", "Informe um email válido.");
  }

  if (role !== "admin" && role !== "operator") {
    throw new AdminUserValidationError("role", "Selecione um perfil válido.");
  }

  return { name, email, role };
}

function isDuplicateError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "23505" || message.includes("already") || message.includes("duplicate");
}

export async function listAdminUsers(): Promise<AdminUserDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id, auth_user_id, email, name, role, active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao listar usuários administrativos.");
  }

  return ((data ?? []) as AdminUserRow[]).map(mapAdminUser);
}

export async function getAdminUser(userId: string): Promise<AdminUserDTO | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id, auth_user_id, email, name, role, active, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Erro ao carregar usuário administrativo.");
  }

  return data ? mapAdminUser(data as AdminUserRow) : null;
}

export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<CreateAdminUserResult> {
  const { name, email, role } = validateCreateInput(input);
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error("Erro ao validar email.");
  }

  if (existing) {
    throw new AdminUserConflictError();
  }

  const initialPassword = generateInitialPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError) {
    if (isDuplicateError(authError)) {
      throw new AdminUserConflictError();
    }
    throw new Error("Erro ao criar usuário de autenticação.");
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    throw new Error("Erro ao criar usuário de autenticação.");
  }

  const { data: row, error: insertError } = await supabase
    .from("admin_users")
    .insert({
      auth_user_id: authUserId,
      email,
      name,
      role,
      active: true,
    })
    .select("id, auth_user_id, email, name, role, active, created_at, updated_at")
    .single();

  if (insertError) {
    const { error: rollbackError } = await supabase.auth.admin.deleteUser(authUserId);
    if (rollbackError) {
      console.error("Failed to rollback admin auth user creation", {
        authUserId,
        rollbackError,
      });
    }

    if (isDuplicateError(insertError)) {
      throw new AdminUserConflictError();
    }

    throw new Error("Erro ao salvar usuário administrativo.");
  }

  return {
    user: mapAdminUser(row as AdminUserRow),
    initialPassword,
  };
}

export async function updateAdminUserRole(
  userId: string,
  role: AdminRole
): Promise<AdminUserDTO> {
  if (role !== "admin" && role !== "operator") {
    throw new AdminUserValidationError("role", "Selecione um perfil válido.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({ role })
    .eq("id", userId)
    .select("id, auth_user_id, email, name, role, active, created_at, updated_at")
    .single();

  if (error) {
    throw new Error("Erro ao atualizar perfil do usuário.");
  }

  return mapAdminUser(data as AdminUserRow);
}

export async function resetAdminUserPassword(
  userId: string
): Promise<{ user: AdminUserDTO; temporaryPassword: string }> {
  const user = await getAdminUser(userId);

  if (!user) {
    throw new Error("Usuário administrativo não encontrado.");
  }

  const temporaryPassword = generateInitialPassword();
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.authUserId, {
    password: temporaryPassword,
  });

  if (error) {
    throw new Error("Erro ao resetar senha do usuário.");
  }

  return { user, temporaryPassword };
}
