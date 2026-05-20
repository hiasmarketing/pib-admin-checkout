"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { ResetAdminUserPasswordActionResult } from "../actions";

interface AdminUserPasswordResetFormProps {
  action: () => Promise<ResetAdminUserPasswordActionResult>;
}

export function AdminUserPasswordResetForm({ action }: AdminUserPasswordResetFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    setError(null);
    setTemporaryPassword(null);

    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
        toast.success("Senha resetada.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--admin-muted)" }}>
        Gere uma senha temporária para este usuário. Ela será exibida apenas uma vez.
      </p>

      {temporaryPassword && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: "color-mix(in srgb, var(--admin-success) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--admin-success) 35%, var(--admin-border))",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--admin-fg)" }}>
            Nova senha temporária
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
            Entregue esta senha ao usuário antes de sair da tela.
          </p>
          <code
            className="mt-3 block select-all rounded-md border px-3 py-2 text-sm break-all"
            style={{
              background: "var(--admin-input-bg)",
              borderColor: "var(--admin-border)",
              color: "var(--admin-fg)",
            }}
          >
            {temporaryPassword}
          </code>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      <AdminButton type="button" variant="secondary" disabled={pending} onClick={handleReset}>
        {pending ? "Resetando..." : "Resetar senha"}
      </AdminButton>
    </div>
  );
}
