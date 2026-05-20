import { resolveSeller } from "@/lib/catalog/sellers";
import { resolveSellerTrackingIdentifier } from "@/lib/tracking";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const identifier = resolveSellerTrackingIdentifier({
    sellerId: params.get("seller_id"),
    sellerSlug: params.get("seller_slug"),
    sellerName: params.get("seller_name"),
  });

  if (!identifier.sellerId && !identifier.sellerSlug) {
    return Response.json({ seller: null });
  }

  const seller = await resolveSeller(identifier);

  if (!seller) {
    return Response.json({ seller: null });
  }

  return Response.json({
    seller: {
      sellerId: seller.sellerId,
      slug: seller.slug,
      name: seller.name,
    },
  });
}
