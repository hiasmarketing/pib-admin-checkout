import { requireAdmin } from "@/lib/admin/auth";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminUserForm } from "../AdminUserForm";
import { createAdminUserAction } from "../actions";

export const metadata = { title: "Novo Usuário — Admin" };

export default async function NewAdminUserPage() {
  await requireAdmin();

  return (
    <div>
      <AdminPageHeader
        title="Novo usuário"
        description="Escolha se o usuário terá acesso de operador ou admin."
        action={
          <AdminButton href="/admin/users" variant="secondary">
            ← Voltar
          </AdminButton>
        }
      />

      <AdminCard className="max-w-lg">
        <AdminUserForm action={createAdminUserAction} />
      </AdminCard>
    </div>
  );
}
