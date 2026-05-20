"use client";

import { useState, useTransition } from "react";
import { updateAdminPasswordAction } from "../actions";

const INPUT_STYLE = {
  background: "var(--admin-input-bg)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-fg)",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  width: "100%",
  fontSize: "0.875rem",
  outline: "none",
} as const;

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.375rem",
  color: "var(--admin-muted)",
} as const;

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: "password" | "confirmPassword"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function fieldErrorFor(field: "password" | "confirmPassword") {
    return fieldError?.field === field ? fieldError.message : null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const data = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateAdminPasswordAction(data);
      if (result?.fieldError) {
        setFieldError(result.fieldError);
      } else if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-6 space-y-4"
      style={{
        background: "var(--admin-surface)",
        borderColor: "var(--admin-border)",
      }}
    >
      <div>
        <label htmlFor="password" style={LABEL_STYLE}>
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={INPUT_STYLE}
        />
        {fieldErrorFor("password") && (
          <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
            {fieldErrorFor("password")}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" style={LABEL_STYLE}>
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={INPUT_STYLE}
        />
        {fieldErrorFor("confirmPassword") && (
          <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>
            {fieldErrorFor("confirmPassword")}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white min-h-[44px] transition-opacity disabled:opacity-50"
        style={{ background: "var(--admin-brand)" }}
      >
        {pending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
