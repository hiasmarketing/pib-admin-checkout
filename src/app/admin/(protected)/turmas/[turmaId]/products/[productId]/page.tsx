import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getProduct } from "@/lib/catalog/products";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { EditProductForm } from "./EditProductForm";

export const metadata = { title: "Editar Produto — Admin" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ turmaId: string; productId: string }>;
}) {
  await requireOperator();
  const { turmaId, productId } = await params;
  const product = await getProduct(productId);

  if (!product || product.turmaId !== turmaId) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`Editar: ${product.name}`}
        action={
          <AdminButton href={`/admin/turmas/${turmaId}`} variant="secondary">
            ← Turma
          </AdminButton>
        }
      />
      <EditProductForm product={product} />
    </div>
  );
}
