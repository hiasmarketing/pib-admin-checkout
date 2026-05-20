import { ForgotPasswordForm } from "./ForgotPasswordForm";
import PibLogo from "@/components/brand/PibLogo";
import "../../admin.css";

export const metadata = { title: "Recuperar senha — Admin PIB " };

export default function ForgotPasswordPage() {
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
            Recuperar senha
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--admin-muted)" }}>
            Área administrativa
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
