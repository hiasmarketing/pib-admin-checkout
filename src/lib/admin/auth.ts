import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminRole = "admin" | "operator";

export interface AdminOperator {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
}

export async function getCurrentOperator(): Promise<AdminOperator | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id, auth_user_id, email, name, role, active")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    authUserId: data.auth_user_id as string,
    email: data.email as string,
    name: data.name as string,
    role: data.role as AdminRole,
    active: data.active as boolean,
  };
}

export async function requireOperator(): Promise<AdminOperator> {
  const operator = await getCurrentOperator();

  if (!operator) {
    redirect("/admin/login");
  }

  return operator;
}

export async function requireAdmin(): Promise<AdminOperator> {
  const operator = await requireOperator();

  if (operator.role !== "admin") {
    redirect("/admin");
  }

  return operator;
}
