"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProfileMenu } from "./AdminProfileMenu";
import PibLogo from "@/components/brand/PibLogo";

type AdminShellOperator = {
  name: string;
  email: string;
  role: "admin" | "operator";
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/leads", label: "Leads", icon: "person-add" },
  { href: "/admin/vendas", label: "Vendas", icon: "dollar" },
  { href: "/admin/turmas", label: "Turmas", icon: "calendar" },
  { href: "/admin/coupons", label: "Cupons", icon: "tag" },
  { href: "/admin/sellers", label: "Vendedores", icon: "users" },
  { href: "/admin/users", label: "Usuários", icon: "shield", adminOnly: true },
  { href: "/admin/utm-builder", label: "UTM Builder", icon: "link" },
  { href: "/admin/webhooks", label: "Webhooks", icon: "zap" },
];

function Icon({ name }: { name: string }) {
  switch (name) {
    case "grid":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "calendar":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "tag":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "users":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case "zap":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "person-add":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "dollar":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      );
    case "link":
      return (
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      );
    default:
      return null;
  }
}

export function AdminSidebar({ operator }: { operator: AdminShellOperator }) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || operator.role === "admin");

  return (
    <aside
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-30 w-60 flex flex-col border-r"
      style={{
        background: "var(--admin-sidebar-bg)",
        borderColor: "var(--admin-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center px-5 py-4 border-b"
        style={{ borderColor: "var(--admin-border)", color: "var(--admin-fg)" }}
      >
        <PibLogo size="sm" />
      </div>

      {/* Navigation */}
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]"
              style={{
                background: isActive
                  ? "color-mix(in srgb, var(--admin-brand) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--admin-brand)" : "var(--admin-muted)",
              }}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-4 border-t flex items-center"
        style={{ borderColor: "var(--admin-border)" }}
      >
        <AdminProfileMenu operator={operator} />
      </div>
    </aside>
  );
}
