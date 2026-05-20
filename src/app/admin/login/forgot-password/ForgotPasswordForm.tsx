"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestAdminPasswordResetAction } from "../actions";

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

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const data = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await requestAdminPasswordResetAction(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
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
        <label htmlFor="email" style={LABEL_STYLE}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" style={INPUT_STYLE} />
      </div>

      {success && (
        <p className="text-sm" style={{ color: "var(--admin-success)" }}>
          Se este email tiver acesso ao admin, enviaremos um link de recuperação.
        </p>
      )}

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
        {pending ? "Enviando..." : "Enviar link"}
      </button>

      <Link
        href="/admin/login"
        className="block text-center text-sm rounded-lg py-2"
        style={{ color: "var(--admin-muted)" }}
      >
        Voltar ao login
      </Link>
    </form>
  );
}
