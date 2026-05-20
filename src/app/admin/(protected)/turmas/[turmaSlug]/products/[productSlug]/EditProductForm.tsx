"use client";

import { ProductForm } from "../ProductForm";
import { updateProductAction } from "../actions";
import type { ProductDTO, TurmaDTO } from "@/lib/catalog/types";

export function EditProductForm({ product, turma }: { product: ProductDTO; turma: TurmaDTO }) {
  const action = updateProductAction.bind(null, product.id);

  return (
    <ProductForm
      turmaId={product.turmaId}
      turmaSlug={turma.slug}
      defaultValues={{
        name: product.name,
        slug: product.slug,
        description: product.description ?? "",
        unitAmountCents: product.unitAmountCents,
        currency: product.currency,
        maxQuantity: product.maxQuantity,
        active: product.active,
        isDefault: product.isDefault,
        installmentOptions: product.installmentOptions,
        paymentMethods: product.paymentMethods,
        installmentRates: product.installmentRates,
      }}
      action={action}
      submitLabel="Salvar alterações"
    />
  );
}
