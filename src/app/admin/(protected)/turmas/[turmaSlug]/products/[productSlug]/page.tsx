import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getTurmaBySlug } from "@/lib/catalog/turmas";
import { getProductBySlug } from "@/lib/catalog/products";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { EditProductForm } from "./EditProductForm";

export const metadata = { title: "Editar Produto — Admin" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ turmaSlug: string; productSlug: string }>;
}) {
  await requireOperator();
  const { turmaSlug, productSlug } = await params;
  const turma = await getTurmaBySlug(turmaSlug);
  if (!turma) notFound();
  const product = await getProductBySlug(turma.id, productSlug);

  if (!product) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`Editar: ${product.name}`}
        action={
          <AdminButton href={`/admin/turmas/${turma.slug}`} variant="secondary">
            ← Turma
          </AdminButton>
        }
      />
      <EditProductForm product={product} turma={turma} />
    </div>
  );
}
