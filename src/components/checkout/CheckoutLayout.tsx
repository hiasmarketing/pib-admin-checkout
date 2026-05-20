"use client";

import { Suspense, useState } from "react";
import DestinyLogo from "@/components/brand/DestinyLogo";
import LanguageToggle from "@/components/checkout/LanguageToggle";
import { useRouter } from "next/navigation";
import { SellerAttributionBar } from "./SellerAttributionBar";

const CHECKOUT_BACKGROUND_IMAGE_URL =
  "/images/checkout-crowd-bg.jpg";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sellerBarVisible, setSellerBarVisible] = useState(false);

  return (
    <div className="relative isolate min-h-screen bg-black flex flex-col">
      <Suspense fallback={null}>
        <SellerAttributionBar onVisibleChange={setSellerBarVisible} />
      </Suspense>
      <Suspense fallback={null}>
        <LanguageToggle
          positionClassName={
            sellerBarVisible
              ? "right-4 top-16 md:right-8 md:top-16"
              : "right-4 top-4 md:right-8 md:top-8"
          }
        />
      </Suspense>

      {/* Background image */}
      <div className="fixed inset-0 z-0 overflow-hidden" data-checkout-background>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 grayscale"
          style={{ backgroundImage: `url(${CHECKOUT_BACKGROUND_IMAGE_URL})` }}
        />
        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black to-transparent" />
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="relative flex justify-center pt-10 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex cursor-pointer items-center gap-1 text-white/70 font-inter text-sm font-medium hover:text-white transition-colors md:left-8"
          >
            ← Voltar
          </button>
          <DestinyLogo priority className="h-auto w-[135px]" />
        </header>

        {/* Page content */}
        <main className="flex-1 w-full max-w-sm mx-auto px-4 md:max-w-xl pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
