"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  loadCatalogSelection,
  loadTracking,
  resolveSellerTrackingIdentifier,
  resolveStoredSellerIdentifier,
} from "@/lib/tracking";

interface ResolvedSellerResponse {
  seller: {
    sellerId: string | null;
    slug: string;
    name: string;
  } | null;
}

interface SellerAttributionBarProps {
  onVisibleChange?: (visible: boolean) => void;
}

export function SellerAttributionBar({
  onVisibleChange,
}: SellerAttributionBarProps) {
  const t = useTranslations("checkoutLayout");
  const searchParams = useSearchParams();
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [hasSellerIdentifier, setHasSellerIdentifier] = useState(false);

  const sellerIdentifier = useMemo(() => {
    return resolveSellerTrackingIdentifier({
      sellerId: searchParams.get("seller_id"),
      sellerSlug: searchParams.get("seller_slug"),
      sellerName: searchParams.get("seller_name"),
    });
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;
    const storedIdentifier = resolveStoredSellerIdentifier(
      loadCatalogSelection(),
      loadTracking()
    );
    const sellerId = sellerIdentifier.sellerId ?? storedIdentifier.sellerId;
    const sellerSlug = sellerIdentifier.sellerSlug ?? storedIdentifier.sellerSlug;

    if (!sellerId && !sellerSlug) {
      window.queueMicrotask(() => {
        setSellerName(null);
        setHasSellerIdentifier(false);
      });
      return;
    }

    window.queueMicrotask(() => setHasSellerIdentifier(true));

    const params = new URLSearchParams();
    if (sellerId) params.set("seller_id", sellerId);
    if (sellerSlug) params.set("seller_slug", sellerSlug);

    fetch(`/api/catalog/seller?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ResolvedSellerResponse | null) => {
        if (!ignore) {
          const name = data?.seller?.name ?? null;
          setSellerName(name);
          if (!name) setHasSellerIdentifier(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSellerName(null);
          setHasSellerIdentifier(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [sellerIdentifier.sellerId, sellerIdentifier.sellerSlug]);

  useEffect(() => {
    onVisibleChange?.(Boolean(sellerName));
  }, [onVisibleChange, sellerName]);

  if (!sellerName) {
    // Reserve bar height while fetch is in progress to prevent layout shift
    if (hasSellerIdentifier) {
      return (
        <div
          className="relative z-20 min-h-12 border-b animate-pulse"
          style={{
            background: "#121212",
            borderColor: "rgba(255,255,255,0.12)",
          }}
        />
      );
    }
    return null;
  }

  return (
    <div
      className="relative z-20 flex min-h-12 items-center justify-center border-b px-4 text-center font-inter text-sm font-semibold"
      style={{
        background: "#121212",
        borderColor: "rgba(255,255,255,0.12)",
        color: "#ffffff",
      }}
    >
      <span>{t("sellerLabel")}</span>
      <span className="ml-1 text-[#ffd600]">{sellerName}</span>
    </div>
  );
}
