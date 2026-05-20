import { requireOperator } from "@/lib/admin/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { ProductForm } from "../ProductForm";
import { createProductAction } from "../actions";

export const metadata = { title: "Novo Produto — Admin" };

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ turmaId: string }>;
}) {
  await requireOperator();
  const { turmaId } = await params;

  return (
    <div>
      <AdminPageHeader
        title="Novo Produto"
        action={
          <AdminButton href={`/admin/turmas/${turmaId}`} variant="secondary">
            ← Voltar
          </AdminButton>
        }
      />
      <ProductForm turmaId={turmaId} action={createProductAction} submitLabel="Criar produto" />
    </div>
  );
}
