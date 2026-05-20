import { requireOperator } from "@/lib/admin/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { TurmaForm } from "../TurmaForm";
import { createTurmaAction } from "../actions";

export const metadata = { title: "Nova Turma — Admin" };

export default async function NewTurmaPage() {
  await requireOperator();

  return (
    <div>
      <AdminPageHeader
        title="Nova Turma"
        action={<AdminButton href="/admin/turmas" variant="secondary">← Voltar</AdminButton>}
      />
      <TurmaForm action={createTurmaAction} submitLabel="Criar turma" />
    </div>
  );
}
