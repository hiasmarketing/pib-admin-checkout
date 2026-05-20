import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getTurmaBySlug } from "@/lib/catalog/turmas";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { ProductForm } from "../ProductForm";
import { createProductAction } from "../actions";

export const metadata = { title: "Novo Produto — Admin" };

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ turmaSlug: string }>;
}) {
  await requireOperator();
  const { turmaSlug } = await params;
  const turma = await getTurmaBySlug(turmaSlug);
  if (!turma) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Novo Produto"
        action={
          <AdminButton href={`/admin/turmas/${turma.slug}`} variant="secondary">
            ← Voltar
          </AdminButton>
        }
      />
      <ProductForm turmaId={turma.id} turmaSlug={turma.slug} action={createProductAction} submitLabel="Criar produto" />
    </div>
  );
}
