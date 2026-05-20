import { requireOperator } from "@/lib/admin/auth";
import { listWebhookEndpoints } from "@/lib/webhooks/outbound";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import Link from "next/link";

export const metadata = { title: "Webhooks — Admin" };

export default async function WebhooksPage() {
  await requireOperator();
  const endpoints = await listWebhookEndpoints();

  return (
    <div>
      <AdminPageHeader
        title="Webhooks"
        description="Endpoints para receber eventos do checkout"
        action={
          <div className="flex gap-2">
            <AdminButton href="/admin/webhooks/deliveries" variant="secondary">
              Ver entregas
            </AdminButton>
            <AdminButton href="/admin/webhooks/new">+ Novo endpoint</AdminButton>
          </div>
        }
      />

      {endpoints.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
          <p className="text-sm">Nenhum endpoint configurado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <Link key={ep.id} href={`/admin/webhooks/${ep.shortId}`} className="block">
              <div
                className="rounded-xl border p-4 hover:border-[var(--admin-brand)]/30 transition-colors"
                style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" style={{ color: "var(--admin-fg)" }}>{ep.name}</span>
                      <AdminStatusChip status={ep.active ? "active" : "inactive"} />
                    </div>
                    <div className="mt-1 text-xs truncate" style={{ color: "var(--admin-muted)" }}>
                      {ep.url} · {ep.subscribedEvents.join(", ")}
                    </div>
                  </div>
                  <div className="text-xs flex-shrink-0" style={{ color: "var(--admin-muted)" }}>Editar →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
