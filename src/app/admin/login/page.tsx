import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentOperator } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";
import "../admin.css";

export const metadata = { title: "Login — Admin PIB — Faria e Castro" };

export default async function AdminLoginPage() {
  const operator = await getCurrentOperator();
  if (operator) redirect("/admin");

  return (
    <div
      className="admin-root min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <Image
              src="/images/logo-pib.png"
              alt="PIB — Faria e Castro"
              width={96}
              height={60}
              priority
            />
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--admin-fg)", fontFamily: "var(--font-sora)" }}
          >
            PIB — Faria e Castro
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--admin-muted)" }}>
            Área administrativa
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
