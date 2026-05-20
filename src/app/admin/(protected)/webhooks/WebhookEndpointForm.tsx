"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";
import type { OutboundWebhookEndpointDTO, OutboundWebhookEventType } from "@/lib/webhooks/outbound";

interface WebhookEndpointFormProps {
  defaultValues?: Partial<OutboundWebhookEndpointDTO & { secretPlaceholder?: boolean }>;
  action: (data: FormData) => Promise<{ error?: string; success?: boolean } | void>;
  submitLabel?: string;
}

const ALL_EVENTS: { value: OutboundWebhookEventType; label: string }[] = [
  { value: "lead.abandoned", label: "Lead abandonado (15min sem compra)" },
  { value: "purchase.approved", label: "Compra aprovada" },
];

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

export function WebhookEndpointForm({ defaultValues, action, submitLabel = "Salvar" }: WebhookEndpointFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedEvents, setSelectedEvents] = useState<OutboundWebhookEventType[]>(
    defaultValues?.subscribedEvents ?? []
  );

  function toggleEvent(event: OutboundWebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const data = new FormData(e.currentTarget);
    data.delete("subscribedEvents");
    for (const ev of selectedEvents) data.append("subscribedEvents", ev);

    startTransition(async () => {
      const result = await action(data);
      if (result?.error) setError(result.error);
      else if (result?.success) toast.success("Endpoint salvo com sucesso!");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="name" style={LABEL_STYLE}>Nome *</label>
        <input id="name" name="name" required autoComplete="off" defaultValue={defaultValues?.name} style={INPUT_STYLE} placeholder="ex: Meu sistema CRM" />
      </div>

      <div>
        <label htmlFor="url" style={LABEL_STYLE}>URL de destino *</label>
        <input id="url" name="url" type="url" required defaultValue={defaultValues?.url} style={INPUT_STYLE} placeholder="https://..." />
      </div>

      <div>
        <span style={LABEL_STYLE}>Eventos inscritos *</span>
        <div className="space-y-2 mt-1">
          {ALL_EVENTS.map((ev) => (
            <label key={ev.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEvents.includes(ev.value)}
                onChange={() => toggleEvent(ev.value)}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: "var(--admin-fg)" }}>{ev.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="secret" style={LABEL_STYLE}>
          Segredo de assinatura {defaultValues?.hasSecret ? "(deixe vazio para manter o atual)" : "(opcional)"}
        </label>
        <input
          id="secret"
          name="secret"
          type="password"
          autoComplete="new-password"
          style={INPUT_STYLE}
          placeholder={defaultValues?.hasSecret ? "••••••••" : "Opcional"}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} value="1" className="w-4 h-4" />
        <span className="text-sm" style={{ color: "var(--admin-fg)" }}>Ativo</span>
      </label>

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
        <AdminButton href="/admin/webhooks" variant="secondary">Cancelar</AdminButton>
      </div>
    </form>
  );
}
