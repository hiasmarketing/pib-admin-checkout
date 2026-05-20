"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";

interface SellerLinkCardProps {
  slug: string;
  href: string;
}

export function SellerLinkCard({ slug, href }: SellerLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      if (!navigator.clipboard?.writeText) {
        toast.error("Copiar link não está disponível neste navegador.");
        return;
      }

      try {
        await navigator.clipboard.writeText(href);
        setCopied(true);
        toast.success("Link do vendedor copiado.");
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Não foi possível copiar o link.");
      }
    });
  }

  return (
    <AdminCard className="mb-6 max-w-3xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div
            className="text-xs uppercase tracking-wider mb-1"
            style={{ color: "var(--admin-muted)" }}
          >
            Link público do vendedor
          </div>
          <div
            className="font-medium text-sm mb-2"
            style={{ color: "var(--admin-fg)" }}
          >
            Slug: <span className="font-mono">{slug}</span>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-sm font-mono break-all"
            style={{
              background: "var(--admin-surface-elevated)",
              borderColor: "var(--admin-border)",
              color: "var(--admin-fg)",
            }}
          >
            {href}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{
            background: "var(--admin-brand)",
            borderColor: "transparent",
            color: "#fff",
          }}
        >
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </AdminCard>
  );
}
