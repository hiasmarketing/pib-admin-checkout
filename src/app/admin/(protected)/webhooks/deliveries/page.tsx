import { requireOperator } from "@/lib/admin/auth";
import { listRecentDeliveries } from "@/lib/webhooks/outbound";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { RetryDeliveryButton } from "./RetryDeliveryButton";
import { formatSaoPauloDateTime } from "@/lib/timezone";

export const metadata = { title: "Entregas de Webhook — Admin" };

export default async function WebhookDeliveriesPage() {
  await requireOperator();
  const deliveries = await listRecentDeliveries(100);

  return (
    <div>
      <AdminPageHeader
        title="Entregas de Webhook"
        description="Últimas 100 tentativas de entrega"
        action={<AdminButton href="/admin/webhooks" variant="secondary">← Endpoints</AdminButton>}
      />

      {deliveries.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
          <p className="text-sm">Nenhuma entrega registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border p-4"
              style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-medium" style={{ color: "var(--admin-brand)" }}>
                      {d.eventType}
                    </span>
                    <AdminStatusChip status={d.status as "delivered" | "failed" | "pending" | "processing" | "dead"} />
                    {d.lastStatusCode && (
                      <span className="text-xs" style={{ color: "var(--admin-muted)" }}>
                        HTTP {d.lastStatusCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs truncate" style={{ color: "var(--admin-muted)" }}>
                    {d.endpointName} · {d.endpointUrl.slice(0, 50)}
                    {d.endpointUrl.length > 50 ? "..." : ""}
                  </div>
                  {d.lastError && (
                    <div className="mt-1 text-xs" style={{ color: "var(--admin-danger)" }}>
                      {d.lastError.slice(0, 100)}
                    </div>
                  )}
                  <div className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
                    {d.attemptCount} tentativa(s) · {formatSaoPauloDateTime(d.createdAt)}
                  </div>
                </div>
                {(d.status === "failed" || d.status === "dead") && (
                  <RetryDeliveryButton deliveryId={d.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
