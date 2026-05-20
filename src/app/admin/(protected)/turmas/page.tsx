import { requireOperator } from "@/lib/admin/auth";
import { listTurmas } from "@/lib/catalog/turmas";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { formatSaoPauloDate } from "@/lib/timezone";
import Link from "next/link";

export const metadata = { title: "Turmas — Admin" };

export default async function TurmasPage() {
  await requireOperator();
  const turmas = await listTurmas();

  return (
    <div>
      <AdminPageHeader
        title="Turmas"
        description="Gerencie as turmas do PIB"
        action={<AdminButton href="/admin/turmas/new">+ Nova turma</AdminButton>}
      />

      {turmas.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl border"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          <p className="text-sm">Nenhuma turma cadastrada ainda.</p>
          <AdminButton href="/admin/turmas/new" className="mt-4">
            Criar primeira turma
          </AdminButton>
        </div>
      ) : (
        <div className="space-y-2">
          {turmas.map((turma) => (
            <Link key={turma.id} href={`/admin/turmas/${turma.slug}`} className="block">
              <div
                className="rounded-xl border p-4 hover:border-[var(--admin-brand)]/30 transition-colors"
                style={{
                  background: "var(--admin-surface)",
                  borderColor: "var(--admin-border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-medium text-sm"
                        style={{ color: "var(--admin-fg)" }}
                      >
                        {turma.name}
                      </span>
                      <AdminStatusChip status={turma.status} />
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
                      /{turma.slug}
                      {turma.location && ` · ${turma.location}`}
                      {turma.startsAt && ` · ${formatSaoPauloDate(turma.startsAt)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      title={turma.whatsappGroupUrl ? "WhatsApp configurado" : "Sem WhatsApp"}
                      aria-label={turma.whatsappGroupUrl ? "WhatsApp configurado" : "WhatsApp não configurado"}
                      className="text-xs"
                      style={{
                        color: turma.whatsappGroupUrl
                          ? "#25D366"
                          : "var(--admin-muted)",
                      }}
                    >
                      {turma.whatsappGroupUrl ? "● WhatsApp" : "○ WhatsApp"}
                    </span>
                    <div className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      Editar →
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
