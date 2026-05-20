"use client";

import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/admin/login/actions";

const THEME_KEY = "admin-theme";

interface AdminProfileMenuProps {
  operator: {
    name: string;
    email: string;
    role: "admin" | "operator";
  };
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function applyTheme(theme: "dark" | "light") {
  if (theme === "light") {
    document.documentElement.setAttribute("data-admin-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-admin-theme");
  }
}

export function AdminProfileMenu({ operator }: AdminProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark";
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const roleLabel = operator.role === "admin" ? "Admin" : "Operador";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="admin-profile-trigger flex w-full min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors"
        style={{
          background: "transparent",
          color: "var(--admin-fg)",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            background: "var(--admin-profile-avatar-bg)",
            color: "var(--admin-profile-avatar-fg)",
          }}
          aria-hidden="true"
        >
          {operator.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-semibold leading-tight">
            {operator.name}
          </span>
          <span className="block text-xs leading-tight" style={{ color: "var(--admin-muted)" }}>
            {roleLabel}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+0.625rem)] -left-4 z-50 w-60 rounded-lg border p-2 shadow-xl"
          style={{
            background: "var(--admin-profile-menu-bg)",
            borderColor: "var(--admin-border)",
          }}
        >
          <div className="px-2.5 pb-2 pt-1">
            <p
              className="overflow-hidden text-ellipsis whitespace-nowrap text-sm"
              style={{ color: "var(--admin-muted)" }}
              title={operator.email}
            >
              {operator.email}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            className="admin-profile-menu-item flex w-full min-h-[38px] items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors"
            style={{ color: "var(--admin-fg)" }}
          >
            <span className="flex w-4 justify-center" style={{ color: "var(--admin-muted)" }}>
              <ThemeIcon />
            </span>
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>

          <div className="my-2 border-t" style={{ borderColor: "var(--admin-border)" }} />

          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="admin-profile-menu-item flex w-full min-h-[38px] items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors"
              style={{
                color: "var(--admin-fg)",
              }}
            >
              <span className="flex w-4 justify-center" style={{ color: "var(--admin-muted)" }}>
                <LogoutIcon />
              </span>
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
