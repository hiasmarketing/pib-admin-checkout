"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { TurmaDTO, ProductDTO, CouponDTO } from "@/lib/catalog/types";
import { formatSaoPauloDateTimeLocalInput } from "@/lib/timezone";

interface CouponFormProps {
  defaultValues?: Partial<CouponDTO>;
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

export function CouponForm({ defaultValues, turmas, products, action, submitLabel = "Salvar" }: CouponFormProps) {
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
      else if (result?.success) toast.success("Cupom salvo com sucesso!");
    });
  }

  function toggleItem(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="code" style={LABEL_STYLE}>Código *</label>
          <input id="code" name="code" required autoComplete="off" spellCheck={false} defaultValue={defaultValues?.code} style={INPUT_STYLE} placeholder="ex: PROMO10" />
          {fieldErrorFor("code") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("code")}</p>}
        </div>
        <div>
          <label htmlFor="name" style={LABEL_STYLE}>Nome interno *</label>
          <input id="name" name="name" required autoComplete="off" defaultValue={defaultValues?.name} style={INPUT_STYLE} />
          {fieldErrorFor("name") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("name")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="discountType" style={LABEL_STYLE}>Tipo de desconto *</label>
          <select id="discountType" name="discountType" defaultValue={defaultValues?.discountType ?? "percent"} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
            <option value="percent">Percentual (%)</option>
            <option value="fixed_amount">Valor fixo (centavos)</option>
          </select>
        </div>
        <div>
          <label htmlFor="discountValue" style={LABEL_STYLE}>Valor do desconto *</label>
          <input id="discountValue" name="discountValue" type="number" min={1} required defaultValue={defaultValues?.discountValue} style={INPUT_STYLE} />
          {fieldErrorFor("discountValue") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("discountValue")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startsAt" style={LABEL_STYLE}>Válido de</label>
          <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaultValues?.startsAt ? formatSaoPauloDateTimeLocalInput(defaultValues.startsAt) : ""} style={INPUT_STYLE} />
        </div>
        <div>
          <label htmlFor="endsAt" style={LABEL_STYLE}>Válido até</label>
          <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={defaultValues?.endsAt ? formatSaoPauloDateTimeLocalInput(defaultValues.endsAt) : ""} style={INPUT_STYLE} />
          {fieldErrorFor("endsAt") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("endsAt")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="maxRedemptions" style={LABEL_STYLE}>Limite de usos</label>
          <input id="maxRedemptions" name="maxRedemptions" type="number" min={1} defaultValue={defaultValues?.maxRedemptions ?? ""} style={INPUT_STYLE} placeholder="Ilimitado" />
        </div>
        <div>
          <label htmlFor="minimumSubtotalCents" style={LABEL_STYLE}>Subtotal mínimo (centavos)</label>
          <input id="minimumSubtotalCents" name="minimumSubtotalCents" type="number" min={1} defaultValue={defaultValues?.minimumSubtotalCents ?? ""} style={INPUT_STYLE} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active} value="1" className="w-4 h-4" />
        <span className="text-sm" style={{ color: "var(--admin-fg)" }}>Ativo</span>
      </label>

      {/* Turma scope */}
      {turmas.length > 0 && (
        <div>
          <span style={LABEL_STYLE}>Restringir a turmas (vazio = global)</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {turmas.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleItem(selectedTurmaIds, setSelectedTurmaIds, t.id)}
                className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                style={{
                  background: selectedTurmaIds.includes(t.id) ? "var(--admin-brand)" : "var(--admin-surface-elevated)",
                  color: selectedTurmaIds.includes(t.id) ? "#fff" : "var(--admin-fg)",
                  borderColor: selectedTurmaIds.includes(t.id) ? "var(--admin-brand)" : "var(--admin-border)",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product scope */}
      {products.length > 0 && (
        <div>
          <span style={LABEL_STYLE}>Restringir a produtos (vazio = global)</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleItem(selectedProductIds, setSelectedProductIds, p.id)}
                className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                style={{
                  background: selectedProductIds.includes(p.id) ? "var(--admin-brand)" : "var(--admin-surface-elevated)",
                  color: selectedProductIds.includes(p.id) ? "#fff" : "var(--admin-fg)",
                  borderColor: selectedProductIds.includes(p.id) ? "var(--admin-brand)" : "var(--admin-border)",
                }}
              >
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
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </AdminButton>
        <AdminButton href="/admin/coupons" variant="secondary">Cancelar</AdminButton>
      </div>
    </form>
  );
}
