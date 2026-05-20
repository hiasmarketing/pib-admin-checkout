"use client";

import { useState, useSyncExternalStore } from "react";

interface CreatedUserPayload {
  email: string;
  role: string;
  initialPassword: string;
}

const STORAGE_KEY = "admin:last-created-user";
let lastStored: string | null = null;
let lastSnapshot: CreatedUserPayload | null = null;

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return null;
}

function getSnapshot(): CreatedUserPayload | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    lastStored = null;
    lastSnapshot = null;
    return null;
  }
  if (stored === lastStored) return lastSnapshot;

  try {
    const payload = JSON.parse(stored) as CreatedUserPayload;
    if (payload.email && payload.initialPassword) {
      lastStored = stored;
      lastSnapshot = payload;
      return payload;
    }
  } catch {
    lastStored = stored;
    lastSnapshot = null;
    return null;
  }

  lastStored = stored;
  lastSnapshot = null;
  return null;
}

export function CreatedAdminUserNotice() {
  const [dismissed, setDismissed] = useState(false);
  const createdUser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!createdUser || dismissed) return null;

  return (
    <div
      className="mb-4 rounded-xl border p-4"
      style={{
        background: "color-mix(in srgb, var(--admin-success) 10%, var(--admin-surface))",
        borderColor: "color-mix(in srgb, var(--admin-success) 35%, var(--admin-border))",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--admin-fg)" }}>
            Usuário criado com sucesso
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
            Senha inicial para {createdUser.email}. Perfil: {createdUser.role}. Esta senha aparece apenas agora.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(STORAGE_KEY);
            setDismissed(true);
          }}
          className="self-start rounded-lg border px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--admin-surface-elevated)",
            borderColor: "var(--admin-border)",
            color: "var(--admin-fg)",
          }}
        >
          Fechar
        </button>
      </div>

      <code
        className="mt-3 block select-all rounded-lg border px-3 py-2 text-sm break-all"
        style={{
          background: "var(--admin-input-bg)",
          borderColor: "var(--admin-border)",
          color: "var(--admin-fg)",
        }}
      >
        {createdUser.initialPassword}
      </code>
    </div>
  );
}
