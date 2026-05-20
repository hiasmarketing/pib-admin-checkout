"use client";

import { Suspense } from "react";
import PibLogo from "@/components/brand/PibLogo";
import { SellerAttributionBar } from "./SellerAttributionBar";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white flex flex-col text-(--color-pib-label,#2b3674)">
      <Suspense fallback={null}>
        <SellerAttributionBar />
      </Suspense>

      <div className="flex-1 w-full mx-auto max-w-6xl px-6 md:px-12 py-10 md:py-16 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-24 items-center">
          {/* Logo column — visible só desktop, vertical centered */}
          <div className="hidden lg:flex lg:sticky lg:top-24 lg:justify-center lg:items-center">
            <PibLogo size="lg" priority />
          </div>

          {/* Mobile/tablet logo header */}
          <div className="flex lg:hidden justify-center mb-4">
            <PibLogo size="md" priority />
          </div>

          {/* Form column */}
          <main className="w-full max-w-[450px] mx-auto lg:mx-0">{children}</main>
        </div>
      </div>

      <footer className="w-full border-t border-(--color-pib-border,#e0e5f2) py-6 px-6 md:px-12">
        <div className="mx-auto max-w-6xl flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <p className="text-xs md:text-sm text-(--color-pib-muted,#a3aed0) font-medium">
            © 2026. All Rights Reserved. Made by{" "}
            <span className="font-bold">PIB</span>
          </p>
          <nav className="flex flex-wrap gap-4 md:gap-6 text-xs md:text-sm font-semibold text-(--color-pib-primary,#12372a)">
            <a href="#" className="hover:underline">Instructions</a>
            <a href="#" className="hover:underline">License</a>
            <a href="#" className="hover:underline">Terms of Use</a>
            <a href="#" className="hover:underline">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
