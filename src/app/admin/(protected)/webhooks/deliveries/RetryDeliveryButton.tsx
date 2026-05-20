"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { retryDeliveryAction } from "../actions";

export function RetryDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const [pending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      const result = await retryDeliveryAction(deliveryId);
      if (result.success) toast.success("Reenvio agendado!");
      else toast.error(result.error ?? "Erro ao reenviar.");
    });
  }

  return (
    <button
      onClick={handleRetry}
      disabled={pending}
      aria-label="Reenviar entrega"
      className="text-xs px-2.5 py-1.5 rounded-lg border transition-opacity disabled:opacity-50 flex-shrink-0 min-h-[44px] min-w-[44px]"
      style={{
        borderColor: "var(--admin-border)",
        color: "var(--admin-muted)",
        background: "var(--admin-surface-elevated)",
      }}
    >
      {pending ? "…" : "Reenviar"}
    </button>
  );
}
