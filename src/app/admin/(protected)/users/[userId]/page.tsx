import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUser } from "@/lib/admin/users";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { resetAdminUserPasswordAction, updateAdminUserRoleAction } from "../actions";
import { AdminUserPasswordResetForm } from "./AdminUserPasswordResetForm";
import { AdminUserRoleForm } from "./AdminUserRoleForm";
import { formatSaoPauloDateTime } from "@/lib/timezone";

export const metadata = { title: "Usuário — Admin" };

function formatDate(date: string): string {
  return formatSaoPauloDateTime(date);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const user = await getAdminUser(userId);

  if (!user) notFound();

  const updateRoleAction = updateAdminUserRoleAction.bind(null, user.id);
  const resetPasswordAction = resetAdminUserPasswordAction.bind(null, user.id);

  return (
    <div>
      <AdminPageHeader
        title={user.name}
        description={user.email}
        action={
          <AdminButton href="/admin/users" variant="secondary">
            ← Voltar
          </AdminButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <section className="space-y-4">
          <AdminCard>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--admin-fg)" }}>
                    Dados do usuário
                  </h2>
                  <AdminStatusChip
                    status={user.active ? "active" : "inactive"}
                    label={user.active ? "Ativo" : "Inativo"}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      Nome
                    </dt>
                    <dd className="mt-1" style={{ color: "var(--admin-fg)" }}>
                      {user.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      Email
                    </dt>
                    <dd className="mt-1 break-all" style={{ color: "var(--admin-fg)" }}>
                      {user.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      Perfil atual
                    </dt>
                    <dd className="mt-1" style={{ color: "var(--admin-fg)" }}>
                      {user.role === "admin" ? "Admin" : "Operador"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs" style={{ color: "var(--admin-muted)" }}>
                      Criado em
                    </dt>
                    <dd className="mt-1" style={{ color: "var(--admin-fg)" }}>
                      {formatDate(user.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-sm font-semibold" style={{ color: "var(--admin-fg)" }}>
              Resetar senha
            </h2>
            <div className="mt-4">
              <AdminUserPasswordResetForm action={resetPasswordAction} />
            </div>
          </AdminCard>
        </section>

        <aside>
          <AdminCard>
            <h2 className="text-sm font-semibold" style={{ color: "var(--admin-fg)" }}>
              Perfil de acesso
            </h2>
            <p className="mt-1 mb-4 text-sm" style={{ color: "var(--admin-muted)" }}>
              Admins podem gerenciar usuários. Operadores acessam apenas as áreas operacionais.
            </p>
            <AdminUserRoleForm defaultRole={user.role} action={updateRoleAction} />
          </AdminCard>
        </aside>
      </div>
    </div>
  );
}
