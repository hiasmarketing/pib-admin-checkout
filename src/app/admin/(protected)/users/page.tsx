import { requireAdmin } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/users";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { CreatedAdminUserNotice } from "./CreatedAdminUserNotice";
import { formatSaoPauloDate } from "@/lib/timezone";
import Link from "next/link";

export const metadata = { title: "Usuários — Admin" };

function formatDate(date: string): string {
  return formatSaoPauloDate(date);
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listAdminUsers();

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        description="Cadastre usuários e gerencie quem tem acesso ao painel."
        action={<AdminButton href="/admin/users/new">+ Novo usuário</AdminButton>}
      />

      <CreatedAdminUserNotice />

      {users.length === 0 ? (
        <AdminCard className="text-center py-10">
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>
            Nenhum usuário administrativo cadastrado ainda.
          </p>
          <AdminButton href="/admin/users/new" className="mt-4">
            Criar primeiro usuário
          </AdminButton>
        </AdminCard>
      ) : (
        <section className="space-y-2">
          {users.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`} className="block">
              <AdminCard className="transition-colors hover:border-[var(--admin-brand)]/30">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-medium" style={{ color: "var(--admin-fg)" }}>
                        {user.name}
                      </h2>
                      <AdminStatusChip
                        status={user.active ? "active" : "inactive"}
                        label={user.active ? "Ativo" : "Inativo"}
                      />
                    </div>
                    <p className="mt-1 text-sm break-all" style={{ color: "var(--admin-muted)" }}>
                      {user.email}
                    </p>
                  </div>
                  <div className="text-xs sm:text-right" style={{ color: "var(--admin-muted)" }}>
                    <div className="font-medium uppercase tracking-wide" style={{ color: "var(--admin-fg)" }}>
                      {user.role === "admin" ? "Admin" : "Operador"}
                    </div>
                    <div className="mt-1">Criado em {formatDate(user.createdAt)}</div>
                    <div className="mt-2" style={{ color: "var(--admin-brand)" }}>
                      Abrir usuário
                    </div>
                  </div>
                </div>
              </AdminCard>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
