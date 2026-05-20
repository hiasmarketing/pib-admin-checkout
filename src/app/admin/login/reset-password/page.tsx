import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { ResetPasswordForm } from "./ResetPasswordForm";
import PibLogo from "@/components/brand/PibLogo";
import "../../admin.css";

export const metadata = { title: "Nova senha — Admin PIB " };
  
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="admin-root min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center" style={{ color: "var(--admin-fg)" }}>
            <PibLogo size="md" />
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--admin-fg)", fontFamily: "var(--font-sora)" }}
          >
            Nova senha
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--admin-muted)" }}>
            Área administrativa
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
