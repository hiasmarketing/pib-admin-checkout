"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_CACHE_TAGS } from "@/lib/admin/cache";
import {
  AdminUserConflictError,
  AdminUserValidationError,
  createAdminUser,
  getAdminUser,
  resetAdminUserPassword,
  updateAdminUserRole,
  type AdminUserDTO,
} from "@/lib/admin/users";
import type { AdminRole } from "@/lib/admin/auth";

export interface CreateAdminUserActionResult {
  user?: AdminUserDTO;
  initialPassword?: string;
  error?: string;
  fieldError?: { field: "name" | "email" | "role"; message: string };
}

export interface UpdateAdminUserRoleActionResult {
  success?: boolean;
  error?: string;
  fieldError?: { field: "role"; message: string };
}

export interface ResetAdminUserPasswordActionResult {
  temporaryPassword?: string;
  error?: string;
}

export async function createAdminUserAction(
  data: FormData
): Promise<CreateAdminUserActionResult> {
  await requireAdmin();

  try {
    const result = await createAdminUser({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      role: String(data.get("role") ?? "operator") as AdminRole,
    });
    revalidatePath("/admin/users");
    revalidateTag(ADMIN_CACHE_TAGS.users, "default");
    return result;
  } catch (err) {
    if (err instanceof AdminUserValidationError) {
      return { fieldError: { field: err.field, message: err.message } };
    }
    if (err instanceof AdminUserConflictError) {
      return { fieldError: { field: "email", message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao criar usuário administrativo." };
  }
}

export async function updateAdminUserRoleAction(
  userId: string,
  data: FormData
): Promise<UpdateAdminUserRoleActionResult> {
  const currentAdmin = await requireAdmin();
  const role = String(data.get("role") ?? "") as AdminRole;

  try {
    const targetUser = await getAdminUser(userId);
    if (!targetUser) {
      return { error: "Usuário administrativo não encontrado." };
    }

    if (targetUser.authUserId === currentAdmin.authUserId && role !== "admin") {
      return {
        fieldError: {
          field: "role",
          message: "Você não pode remover o próprio acesso admin.",
        },
      };
    }

    const updatedUser = await updateAdminUserRole(userId, role);

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${updatedUser.shortId}`);
    revalidateTag(ADMIN_CACHE_TAGS.users, "default");
    return { success: true };
  } catch (err) {
    if (err instanceof AdminUserValidationError) {
      return { fieldError: { field: "role", message: err.message } };
    }
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao atualizar perfil do usuário." };
  }
}

export async function resetAdminUserPasswordAction(
  userId: string
): Promise<ResetAdminUserPasswordActionResult> {
  await requireAdmin();

  try {
    const result = await resetAdminUserPassword(userId);
    return { temporaryPassword: result.temporaryPassword };
  } catch (err) {
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Erro ao resetar senha do usuário." };
  }
}
