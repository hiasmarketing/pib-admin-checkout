"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { getCurrentOperator } from "@/lib/admin/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getAdminAuthCallbackUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return `${configuredUrl}/admin/auth/callback?next=/admin/login/reset-password`;
}

export async function loginAction(params: {
  email: string;
  password: string;
}): Promise<{ error: string } | void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  if (error) {
    return { error: "Credenciais inválidas." };
  }

  const operator = await getCurrentOperator();

  if (!operator) {
    await supabase.auth.signOut();
    return { error: "Usuário não autorizado como operador ativo." };
  }

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function requestAdminPasswordResetAction(
  data: FormData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const email = normalizeEmail(String(data.get("email") ?? ""));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um email válido." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAdminAuthCallbackUrl(),
  });

  if (error) {
    return { error: "Não foi possível enviar o email de recuperação agora." };
  }

  return { success: true };
}

export async function updateAdminPasswordAction(
  data: FormData
): Promise<{ error?: string; fieldError?: { field: "password" | "confirmPassword"; message: string } } | void> {
  const password = String(data.get("password") ?? "");
  const confirmPassword = String(data.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { fieldError: { field: "password", message: "Use pelo menos 8 caracteres." } };
  }

  if (password !== confirmPassword) {
    return { fieldError: { field: "confirmPassword", message: "As senhas não conferem." } };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Não foi possível atualizar a senha." };
  }

  redirect("/admin");
}
