import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

function safeNextPath(value: string | null): string {
  if (!value) return "/admin/login/reset-password";
  if (!value.startsWith("/admin/") || value.startsWith("//")) {
    return "/admin/login/reset-password";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login/forgot-password", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/admin/login/forgot-password", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
