"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const data = new FormData(e.currentTarget);
    const email = data.get("email") as string;
    const password = data.get("password") as string;

    startTransition(async () => {
      const result = await loginAction({ email, password });
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const inputStyle = {
    background: "var(--admin-input-bg)",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-fg)",
    borderRadius: "0.5rem",
    padding: "0.625rem 0.875rem",
    width: "100%",
    fontSize: "0.875rem",
    outline: "none",
  } as const;

  const labelStyle = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: "0.375rem",
    color: "var(--admin-muted)",
  } as const;

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
        <label htmlFor="email" style={labelStyle}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
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
        {pending ? "Entrando..." : "Entrar"}
      </button>

      <Link
        href="/admin/login/forgot-password"
        className="block text-center text-sm rounded-lg py-2"
        style={{ color: "var(--admin-muted)" }}
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
