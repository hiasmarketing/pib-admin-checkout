import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";
import PibLogo from "@/components/brand/PibLogo";
import "../admin.css";

export const metadata = { title: "Login — Admin PIB" };

export default async function AdminLoginPage() {
  const operator = await getCurrentOperator();
  if (operator) redirect("/admin");

  return (
    <div
      className="admin-root min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center" style={{ color: "var(--admin-fg)" }}>
            <PibLogo size="md" />
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--admin-muted)" }}>
            Área administrativa
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
