"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { AdminRole } from "@/lib/admin/auth";
import type { UpdateAdminUserRoleActionResult } from "../actions";

interface AdminUserRoleFormProps {
  defaultRole: AdminRole;
  action: (data: FormData) => Promise<UpdateAdminUserRoleActionResult>;
}

const SELECT_STYLE = {
  background: "var(--admin-input-bg)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-fg)",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  width: "100%",
  fontSize: "0.875rem",
} as const;

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.375rem",
  color: "var(--admin-muted)",
} as const;

export function AdminUserRoleForm({ defaultRole, action }: AdminUserRoleFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const data = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await action(data);
      if (result.fieldError) {
        setFieldError(result.fieldError.message);
      } else if (result.error) {
        setError(result.error);
      } else if (result.success) {
        toast.success("Perfil atualizado.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="role" style={LABEL_STYLE}>
          Perfil
        </label>
        <select id="role" name="role" defaultValue={defaultRole} required style={SELECT_STYLE}>
          <option value="operator">Operador</option>
          <option value="admin">Admin</option>
        </select>
        {fieldError && (
          <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
            {fieldError}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      <AdminButton type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar perfil"}
      </AdminButton>
    </form>
  );
}
