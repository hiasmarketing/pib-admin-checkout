"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { CreateAdminUserActionResult } from "./actions";

interface AdminUserFormProps {
  action: (data: FormData) => Promise<CreateAdminUserActionResult>;
}

const INPUT_STYLE = {
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

export function AdminUserForm({ action }: AdminUserFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<CreateAdminUserActionResult["fieldError"] | null>(null);
  const [pending, startTransition] = useTransition();

  function fieldErrorFor(field: "name" | "email" | "role") {
    return fieldError?.field === field ? fieldError.message : null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await action(data);

      if (result.fieldError) {
        setFieldError(result.fieldError);
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.user && result.initialPassword) {
        window.sessionStorage.setItem("admin:last-created-user", JSON.stringify({
          email: result.user.email,
          role: result.user.role === "admin" ? "Admin" : "Operador",
          initialPassword: result.initialPassword,
        }));
        form.reset();
        toast.success("Usuário criado com sucesso.");
        router.push("/admin/users");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" style={LABEL_STYLE}>
            Nome *
          </label>
          <input id="name" name="name" required autoComplete="name" style={INPUT_STYLE} />
          {fieldErrorFor("name") && (
            <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
              {fieldErrorFor("name")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" style={LABEL_STYLE}>
            Email *
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" style={INPUT_STYLE} />
          {fieldErrorFor("email") && (
            <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
              {fieldErrorFor("email")}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="role" style={LABEL_STYLE}>
          Perfil *
        </label>
        <select id="role" name="role" defaultValue="operator" required style={INPUT_STYLE}>
          <option value="operator">Operador</option>
          <option value="admin">Admin</option>
        </select>
        {fieldErrorFor("role") && (
          <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
            {fieldErrorFor("role")}
          </p>
        )}
      </div>

      <p
        role="alert"
        aria-live="polite"
        className="text-sm"
        style={{ color: "var(--admin-danger)", minHeight: "1.25rem" }}
      >
        {error ?? ""}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar usuário"}
        </AdminButton>
        <AdminButton href="/admin/users" variant="secondary">
          Cancelar
        </AdminButton>
      </div>
    </form>
  );
}
