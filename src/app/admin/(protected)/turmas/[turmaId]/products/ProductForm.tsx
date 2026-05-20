"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import { applyInstallmentInterest } from "@/lib/catalog/installments";

interface ProductFormProps {
  turmaId: string;
  defaultValues?: {
    name: string;
    slug: string;
    description: string;
    unitAmountCents: number;
    currency: string;
    maxQuantity: number;
    active: boolean;
    isDefault: boolean;
    installmentOptions: number[];
    paymentMethods: string[];
    installmentRates: Record<string, number>;
  };
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

function formatCurrency(cents: number, currency: string): string {
  const normalizedCurrency = currency === "usd" ? "USD" : "BRL";

  return new Intl.NumberFormat(normalizedCurrency === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: normalizedCurrency,
  }).format(cents / 100);
}

function formatRateInput(rate: number | undefined): string {
  if (rate === undefined || !Number.isFinite(rate)) return "";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate);
}

function parseRateInput(value: string): number | null {
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("-")) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex >= 0) {
    const integerPart = cleaned.slice(0, decimalIndex).replace(/\D/g, "") || "0";
    const decimalPart = cleaned.slice(decimalIndex + 1).replace(/\D/g, "");
    const rate = Number(`${integerPart}.${decimalPart.slice(0, 2)}`);
    return Number.isFinite(rate) && rate >= 0 ? rate : null;
  }

  const rate = Number(cleaned.replace(/\D/g, ""));
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function getSharedInstallmentRateInput(rates: Record<string, number> | undefined): string {
  const firstInstallmentRate = Object.entries(rates ?? {}).find(
    ([installment, rate]) =>
      Number(installment) > 1 && Number.isFinite(rate) && rate >= 0
  );

  return firstInstallmentRate ? formatRateInput(firstInstallmentRate[1]) : "";
}

export function ProductForm({ turmaId, defaultValues, action, submitLabel = "Salvar" }: ProductFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [unitAmountCents, setUnitAmountCents] = useState(
    defaultValues?.unitAmountCents ? String(defaultValues.unitAmountCents) : ""
  );
  const [currency, setCurrency] = useState(defaultValues?.currency ?? "brl");
  const [installments, setInstallments] = useState<number[]>(
    defaultValues?.installmentOptions ?? [1]
  );
  const [installmentRateInput, setInstallmentRateInput] = useState(() =>
    getSharedInstallmentRateInput(defaultValues?.installmentRates)
  );
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    defaultValues?.paymentMethods ?? ["card"]
  );

  const allInstallments = [1, 2, 3, 6, 12];
  const allPaymentMethods = [
    { value: "card", label: "Cartão" },
    { value: "pix", label: "Pix" },
    { value: "klarna", label: "Klarna" },
    { value: "afterpay_clearpay", label: "Afterpay/Clearpay" },
  ];
  const selectedCheckoutCurrencies =
    currency === "usd" ? ["brl", "usd"] : ["brl"];
  const pricePlaceholder =
    currency === "usd" ? "ex: 99700 = US$997.00" : "ex: 149700 = R$1.497,00";

  function toggleInstallment(n: number) {
    setInstallments((prev) =>
      prev.includes(n) ? prev.filter((i) => i !== n) : [...prev, n].sort((a, b) => a - b)
    );
  }

  function chooseCheckoutCurrency(nextCurrency: "brl" | "usd") {
    setCurrency(nextCurrency);
  }

  function buildInstallmentRates() {
    const parsed = parseRateInput(installmentRateInput);
    if (parsed === null) return {};

    return Object.fromEntries(
      installments
        .filter((installment) => installment > 1)
        .map((installment) => [String(installment), parsed])
    );
  }

  function getInstallmentPreview(installment: number): string {
    const baseAmount = Number(unitAmountCents);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return "Informe o preço para pré-visualizar";
    }

    const rate = installment > 1 ? parseRateInput(installmentRateInput) : null;
    const result = applyInstallmentInterest(baseAmount, installment, rate);

    if (installment === 1) {
      return formatCurrency(result.totalCents, currency);
    }

    if (rate !== null && rate > 0) {
      return `${installment}x de ${formatCurrency(result.perInstallmentCents, currency)} (total ${formatCurrency(result.totalCents, currency)})`;
    }

    return `${installment}x de ${formatCurrency(result.perInstallmentCents, currency)} (sem juros)`;
  }

  function togglePaymentMethod(method: string) {
    setPaymentMethods((prev) => {
      if (prev.includes(method)) {
        const next = prev.filter((item) => item !== method);
        return next.length > 0 ? next : prev;
      }
      return [...prev, method];
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const data = new FormData(e.currentTarget);
    // Override installment_options with our controlled state
    data.delete("installmentOptions");
    for (const i of installments) {
      data.append("installmentOptions", String(i));
    }
    data.delete("paymentMethods");
    for (const method of paymentMethods) {
      data.append("paymentMethods", method);
    }
    data.set("installmentRates", JSON.stringify(buildInstallmentRates()));

    startTransition(async () => {
      const result = await action(data);
      if (result?.error) setError(result.error);
      else if (result?.fieldError) setFieldError(result.fieldError);
      else if (result?.success) toast.success("Produto salvo com sucesso!");
    });
  }

  function fieldErrorFor(field: string) {
    return fieldError?.field === field ? fieldError.message : null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <input type="hidden" name="turmaId" value={turmaId} />

      <div>
        <label htmlFor="name" style={LABEL_STYLE}>Nome *</label>
        <input id="name" name="name" required autoComplete="off" defaultValue={defaultValues?.name} style={INPUT_STYLE} />
        {fieldErrorFor("name") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("name")}</p>}
      </div>

      <div>
        <label htmlFor="slug" style={LABEL_STYLE}>Slug *</label>
        <input id="slug" name="slug" required autoComplete="off" spellCheck={false} defaultValue={defaultValues?.slug} style={INPUT_STYLE} placeholder="ex: ingresso-vip" />
        {fieldErrorFor("slug") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("slug")}</p>}
      </div>

      <div>
        <label htmlFor="description" style={LABEL_STYLE}>Descrição</label>
        <textarea id="description" name="description" defaultValue={defaultValues?.description} rows={2} style={{ ...INPUT_STYLE, resize: "vertical" }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="unitAmountCents" style={LABEL_STYLE}>Preço (centavos) *</label>
          <input
            id="unitAmountCents"
            name="unitAmountCents"
            type="number"
            required
            min={1}
            value={unitAmountCents}
            onChange={(event) => setUnitAmountCents(event.target.value)}
            style={INPUT_STYLE}
            placeholder={pricePlaceholder}
          />
          {fieldErrorFor("unitAmountCents") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("unitAmountCents")}</p>}
        </div>
        <div>
          <span style={LABEL_STYLE}>Moedas disponíveis *</span>
          <input type="hidden" name="currency" value={currency} />
          <div className="flex gap-2 mt-1 flex-wrap">
            {[
              { value: "brl" as const, label: "BRL" },
              { value: "usd" as const, label: "USD" },
            ].map((option) => {
              const selected = selectedCheckoutCurrencies.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseCheckoutCurrency(option.value)}
                  aria-pressed={selected}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors min-h-[44px] cursor-pointer"
                  style={{
                    background: selected
                      ? "var(--admin-brand)"
                      : "var(--admin-surface-elevated)",
                    color: selected ? "#fff" : "var(--admin-fg)",
                    borderColor: selected
                      ? "var(--admin-brand)"
                      : "var(--admin-border)",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
            {currency === "usd"
              ? "USD habilita dólar via Stripe e real via pagar.me com conversão automática."
              : "BRL vende apenas em real pelo pagar.me."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="maxQuantity" style={LABEL_STYLE}>Qtd máxima por pedido *</label>
          <input
            id="maxQuantity"
            name="maxQuantity"
            type="number"
            required
            min={1}
            max={10}
            defaultValue={defaultValues?.maxQuantity ?? 5}
            style={INPUT_STYLE}
          />
          {fieldErrorFor("maxQuantity") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("maxQuantity")}</p>}
        </div>
      </div>

      <div>
        <span style={LABEL_STYLE}>Parcelamentos disponíveis *</span>
        <div className="flex gap-2 mt-1 flex-wrap">
          {allInstallments.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggleInstallment(n)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors min-h-[44px]"
              style={{
                background: installments.includes(n) ? "var(--admin-brand)" : "var(--admin-surface-elevated)",
                color: installments.includes(n) ? "#fff" : "var(--admin-fg)",
                borderColor: installments.includes(n) ? "var(--admin-brand)" : "var(--admin-border)",
              }}
            >
              {n}x
            </button>
          ))}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
          A taxa mensal de juros abaixo vale para todas as parcelas selecionadas acima de 1x.
        </p>
        {fieldErrorFor("installmentOptions") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("installmentOptions")}</p>}
      </div>

      <div>
        <label htmlFor="installmentRatePct" style={LABEL_STYLE}>Taxa mensal de juros do parcelamento (%)</label>
        <div className="relative">
          <input
            id="installmentRatePct"
            type="text"
            inputMode="decimal"
            value={installmentRateInput}
            onChange={(event) => setInstallmentRateInput(event.target.value)}
            placeholder="0 ou 12,5"
            aria-describedby="installmentRatePct-help"
            style={{ ...INPUT_STYLE, paddingRight: "2.25rem" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: "var(--admin-muted)" }}
          >
            %
          </span>
        </div>
        <p id="installmentRatePct-help" className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
          Deixe vazio ou use 0 para parcelar sem juros. A taxa mensal é aplicada pela fórmula Price em 2x, 3x, 6x e 12x quando estiverem habilitados; 1x permanece à vista.
        </p>
        <div className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: "var(--admin-border)" }}>
          <div className="border-b px-3 py-2 text-xs" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
            Preview
          </div>
          <div className="divide-y divide-[var(--admin-border)]">
            {installments.map((installment) => (
              <div
                key={installment}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 px-3 py-3 sm:items-center"
              >
                <span className="text-sm font-medium" style={{ color: "var(--admin-fg)" }}>
                  {installment}x
                </span>
                <span className="text-sm" style={{ color: "var(--admin-muted)" }}>
                  {getInstallmentPreview(installment)}
                </span>
              </div>
            ))}
          </div>
        </div>
        {fieldErrorFor("installmentRates") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("installmentRates")}</p>}
      </div>

      <div>
        <span style={LABEL_STYLE}>Métodos de pagamento *</span>
        <div className="flex gap-2 mt-1 flex-wrap">
          {allPaymentMethods.map((method) => {
            const selected = paymentMethods.includes(method.value);
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => togglePaymentMethod(method.value)}
                aria-pressed={selected}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors min-h-[44px]"
                style={{
                  background: selected
                    ? "var(--admin-brand)"
                    : "var(--admin-surface-elevated)",
                  color: selected ? "#fff" : "var(--admin-fg)",
                  borderColor: selected
                    ? "var(--admin-brand)"
                    : "var(--admin-border)",
                }}
              >
                {method.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
          O checkout público só mostra métodos habilitados neste produto e elegíveis para moeda, país e valor.
        </p>
        {fieldErrorFor("paymentMethods") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("paymentMethods")}</p>}
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="active" defaultChecked={defaultValues?.active} value="1" className="w-4 h-4" />
          <span className="text-sm" style={{ color: "var(--admin-fg)" }}>Ativo</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isDefault" defaultChecked={defaultValues?.isDefault} value="1" className="w-4 h-4" />
          <span className="text-sm" style={{ color: "var(--admin-fg)" }}>Produto padrão da turma</span>
        </label>
      </div>

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
        <AdminButton href={`/admin/turmas/${turmaId}`} variant="secondary">
          Cancelar
        </AdminButton>
      </div>
    </form>
  );
}
