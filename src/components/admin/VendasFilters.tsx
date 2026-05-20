"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type Props = {
  defaultQ?: string;
  defaultSeller?: string;
  defaultFrom?: string;
  defaultTo?: string;
  defaultStatus?: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "paid", label: "Pago" },
  { value: "pending_payment", label: "Pendente" },
  { value: "payment_failed", label: "Falhou" },
  { value: "canceled", label: "Cancelado" },
];

export function VendasFilters({
  defaultQ = "",
  defaultSeller = "",
  defaultFrom = "",
  defaultTo = "",
  defaultStatus = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(defaultQ);
  const [seller, setSeller] = useState(defaultSeller);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState(defaultStatus);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (q) params.set("q", q); else params.delete("q");
    if (seller) params.set("seller", seller); else params.delete("seller");
    if (from) params.set("from", from); else params.delete("from");
    if (to) params.set("to", to); else params.delete("to");
    if (status) params.set("status", status); else params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleClear() {
    setQ("");
    setSeller("");
    setFrom("");
    setTo("");
    setStatus("");
    const params = new URLSearchParams();
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  const inputStyle = {
    background: "var(--admin-surface-elevated)",
    color: "var(--admin-fg)",
    borderColor: "var(--admin-border)",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-4">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou e-mail"
        className="rounded-lg px-3 py-2 text-sm border flex-1 min-w-[200px]"
        style={inputStyle}
      />
      <input
        type="text"
        value={seller}
        onChange={(e) => setSeller(e.target.value)}
        placeholder="Vendedor"
        aria-label="Filtrar vendas por vendedor"
        className="rounded-lg px-3 py-2 text-sm border min-w-[160px]"
        style={inputStyle}
      />
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm border"
        style={inputStyle}
        aria-label="De"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm border"
        style={inputStyle}
        aria-label="Até"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm border"
        style={inputStyle}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--admin-brand)" }}
      >
        Filtrar
      </button>
      <button
        type="button"
        onClick={handleClear}
        className="rounded-lg px-4 py-2 text-sm"
        style={{ color: "var(--admin-muted)" }}
      >
        Limpar
      </button>
    </form>
  );
}
