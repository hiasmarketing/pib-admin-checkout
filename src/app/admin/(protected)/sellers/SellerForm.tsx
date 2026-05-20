"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { TurmaDTO, ProductDTO, SellerDTO } from "@/lib/catalog/types";

interface SellerFormProps {
  defaultValues?: Partial<SellerDTO>;
  turmas: TurmaDTO[];
  products: ProductDTO[];
  action: (data: FormData) => Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void>;
  submitLabel?: string;
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

export function SellerForm({ defaultValues, turmas, products, action, submitLabel = "Salvar" }: SellerFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedTurmaIds, setSelectedTurmaIds] = useState<string[]>(defaultValues?.turmaIds ?? []);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(defaultValues?.productIds ?? []);

  function fieldErrorFor(field: string) {
    return fieldError?.field === field ? fieldError.message : null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const data = new FormData(e.currentTarget);
    data.delete("turmaIds");
    data.delete("productIds");
    for (const id of selectedTurmaIds) data.append("turmaIds", id);
    for (const id of selectedProductIds) data.append("productIds", id);

    startTransition(async () => {
      const result = await action(data);
      if (result?.error) setError(result.error);
      else if (result?.fieldError) setFieldError(result.fieldError);
      else if (result?.success) toast.success("Vendedor salvo com sucesso!");
    });
  }

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" style={LABEL_STYLE}>Nome *</label>
          <input id="name" name="name" required autoComplete="off" defaultValue={defaultValues?.name} style={INPUT_STYLE} />
          {fieldErrorFor("name") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("name")}</p>}
        </div>
        <div>
          <label htmlFor="slug" style={LABEL_STYLE}>Slug público do link *</label>
          <input id="slug" name="slug" required autoComplete="off" spellCheck={false} defaultValue={defaultValues?.slug} style={INPUT_STYLE} placeholder="ex: vanessa-rios" />
          {fieldErrorFor("slug") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("slug")}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="sellerId" style={LABEL_STYLE}>ID externo / CRM (seller_id)</label>
        <input id="sellerId" name="sellerId" defaultValue={defaultValues?.sellerId ?? ""} style={INPUT_STYLE} placeholder="Opcional, ex: ID no CRM" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" style={LABEL_STYLE}>Email</label>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultValues?.email ?? ""} style={INPUT_STYLE} />
        </div>
        <div>
          <label htmlFor="phone" style={LABEL_STYLE}>Telefone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={defaultValues?.phone ?? ""} style={INPUT_STYLE} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} value="1" className="w-4 h-4" />
        <span className="text-sm" style={{ color: "var(--admin-fg)" }}>Ativo</span>
      </label>

      {turmas.length > 0 && (
        <div>
          <span style={LABEL_STYLE}>Restringir a turmas (vazio = global)</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {turmas.map((t) => (
              <button key={t.id} type="button" onClick={() => toggle(selectedTurmaIds, setSelectedTurmaIds, t.id)}
                className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                style={{
                  background: selectedTurmaIds.includes(t.id) ? "var(--admin-brand)" : "var(--admin-surface-elevated)",
                  color: selectedTurmaIds.includes(t.id) ? "#fff" : "var(--admin-fg)",
                  borderColor: selectedTurmaIds.includes(t.id) ? "var(--admin-brand)" : "var(--admin-border)",
                }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div>
          <span style={LABEL_STYLE}>Restringir a produtos (vazio = global)</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {products.map((p) => (
              <button key={p.id} type="button" onClick={() => toggle(selectedProductIds, setSelectedProductIds, p.id)}
                className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                style={{
                  background: selectedProductIds.includes(p.id) ? "var(--admin-brand)" : "var(--admin-surface-elevated)",
                  color: selectedProductIds.includes(p.id) ? "#fff" : "var(--admin-fg)",
                  borderColor: selectedProductIds.includes(p.id) ? "var(--admin-brand)" : "var(--admin-border)",
                }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p
        role="alert"
        aria-live="polite"
        className="text-sm"
        style={{ color: "var(--admin-danger)", minHeight: "1.25rem" }}
      >
        {error ?? ""}
      </p>

      <div className="flex gap-3 pt-2">
        <AdminButton type="submit" disabled={pending}>{pending ? "Salvando…" : submitLabel}</AdminButton>
        <AdminButton href="/admin/sellers" variant="secondary">Cancelar</AdminButton>
      </div>
    </form>
  );
}
