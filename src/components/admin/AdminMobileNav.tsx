"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AdminProfileMenu } from "./AdminProfileMenu";

type AdminShellOperator = {
  name: string;
  email: string;
  role: "admin" | "operator";
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/vendas", label: "Vendas" },
  { href: "/admin/turmas", label: "Turmas" },
  { href: "/admin/coupons", label: "Cupons" },
  { href: "/admin/sellers", label: "Vendedores" },
  { href: "/admin/users", label: "Usuários", adminOnly: true },
  { href: "/admin/utm-builder", label: "UTM Builder" },
  { href: "/admin/webhooks", label: "Webhooks" },
];

export function AdminMobileNav({ operator }: { operator: AdminShellOperator }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || operator.role === "admin");

  return (
    <>
      {/* Top bar */}
      <header
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-16 border-b md:hidden"
        style={{ background: "var(--admin-sidebar-bg)", borderColor: "var(--admin-border)" }}
      >
        <div className="flex items-center">
          <Image
            src="/images/logo-destiny.png"
            alt="Método Destiny"
            width={618}
            height={384}
            style={{ filter: "var(--logo-filter)", width: "auto", height: "46px" }}
            priority
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border transition-colors"
            style={{
              color: "var(--admin-fg)",
              borderColor: "var(--admin-border)",
              background: "var(--admin-surface-elevated)",
            }}
            aria-label="Abrir menu"
          >
            <svg aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Drawer overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden"
            style={{ background: "var(--admin-sidebar-bg)", overscrollBehavior: "contain" }}
          >
            <div className="flex items-center justify-between px-4 h-16 border-b flex-shrink-0" style={{ borderColor: "var(--admin-border)" }}>
              <Image
                src="/images/logo-destiny.png"
                alt="Método Destiny"
                width={618}
                height={384}
                style={{ filter: "var(--logo-filter)", width: "auto", height: "46px" }}
              />
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg border transition-colors"
                style={{
                  color: "var(--admin-fg)",
                  borderColor: "var(--admin-border)",
                  background: "var(--admin-surface-elevated)",
                }}
                aria-label="Fechar menu"
              >
                <svg aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center px-3 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors"
                    style={{
                      color: isActive ? "var(--admin-brand)" : "var(--admin-fg)",
                      background: isActive ? "color-mix(in srgb, var(--admin-brand) 10%, transparent)" : "transparent",
                    }}
                  >
                    {isActive && (
                      <span
                        className="w-1 h-4 rounded-full mr-2 flex-shrink-0"
                        style={{ background: "var(--admin-brand)" }}
                      />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-4 border-t flex items-center" style={{ borderColor: "var(--admin-border)" }}>
              <AdminProfileMenu operator={operator} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
