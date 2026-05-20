export interface TrackingData {
  utms: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    ref: string | null;
  };
  seller: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface CatalogSelectionData {
  turmaId?: string | null;
  turmaSlug?: string | null;
  productId?: string | null;
  productSlug?: string | null;
  sellerId?: string | null;
  sellerSlug?: string | null;
}

const STORAGE_KEY = "destiny_tracking";
const CATALOG_SELECTION_KEY = "destiny_catalog_selection";
const SELLER_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function isSlugLikeSellerName(value: string | null | undefined): boolean {
  const cleaned = cleanText(value);
  return cleaned ? SELLER_SLUG_RE.test(cleaned) : false;
}

export function resolveSellerTrackingIdentifier(params: {
  sellerId?: string | null;
  sellerSlug?: string | null;
  sellerName?: string | null;
}): { sellerId: string | null; sellerSlug: string | null } {
  const sellerId = cleanText(params.sellerId);
  if (sellerId) return { sellerId, sellerSlug: null };

  const sellerSlug = cleanText(params.sellerSlug);
  if (sellerSlug) return { sellerId: null, sellerSlug };

  const sellerName = cleanText(params.sellerName);
  if (isSlugLikeSellerName(sellerName)) {
    return { sellerId: null, sellerSlug: sellerName };
  }

  return { sellerId: null, sellerSlug: null };
}

export function resolveStoredSellerIdentifier(
  selection?: CatalogSelectionData | null,
  tracking?: TrackingData | null
): { sellerId: string | null; sellerSlug: string | null } {
  return resolveSellerTrackingIdentifier({
    sellerId: selection?.sellerId ?? tracking?.seller.id,
    sellerSlug: selection?.sellerSlug ?? tracking?.seller.slug,
    sellerName: tracking?.seller.name,
  });
}

export function captureTrackingFromParams(params: URLSearchParams): TrackingData {
  return {
    utms: {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      ref: params.get("ref"),
    },
    seller: {
      id: params.get("seller_id"),
      slug: params.get("seller_slug"),
      name: params.get("seller_name"),
    },
  };
}

export function captureSelectionFromParams(
  params: URLSearchParams
): CatalogSelectionData {
  const seller = resolveSellerTrackingIdentifier({
    sellerId: params.get("seller_id"),
    sellerSlug: params.get("seller_slug"),
    sellerName: params.get("seller_name"),
  });

  return {
    turmaId: params.get("turmaId") || null,
    turmaSlug: params.get("turma") || null,
    productId: params.get("productId") || null,
    productSlug: params.get("produto") || null,
    sellerId: seller.sellerId,
    sellerSlug: seller.sellerSlug,
  };
}

export function saveTracking(data: TrackingData): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadTracking(): TrackingData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrackingData;
  } catch {
    return null;
  }
}

export function saveCatalogSelection(data: CatalogSelectionData): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CATALOG_SELECTION_KEY, JSON.stringify(data));
}

export function loadCatalogSelection(): CatalogSelectionData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CATALOG_SELECTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CatalogSelectionData;
  } catch {
    return null;
  }
}
