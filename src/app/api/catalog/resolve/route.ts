import { resolveCatalogProduct } from "@/lib/catalog/resolve";
import type { CatalogSelection } from "@/lib/catalog/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const selection: CatalogSelection = {
    turmaId: params.get("turmaId") || undefined,
    turmaSlug: params.get("turma") || undefined,
    productId: params.get("productId") || undefined,
    productSlug: params.get("produto") || undefined,
    sellerId: params.get("seller_id") || undefined,
    sellerSlug: params.get("seller_slug") || undefined,
  };

  if (!selection.turmaId && !selection.turmaSlug) {
    return Response.json({ error: "Turma não informada." }, { status: 400 });
  }

  try {
    const resolved = await resolveCatalogProduct(selection);
    return Response.json({ resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Produto não disponível.";
    return Response.json({ error: message }, { status: 404 });
  }
}
