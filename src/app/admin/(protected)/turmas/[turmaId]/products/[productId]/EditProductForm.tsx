"use client";

import { ProductForm } from "../ProductForm";
import { updateProductAction } from "../actions";
import type { ProductDTO } from "@/lib/catalog/types";

export function EditProductForm({ product }: { product: ProductDTO }) {
  const action = updateProductAction.bind(null, product.id);

  return (
    <ProductForm
      turmaId={product.turmaId}
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
