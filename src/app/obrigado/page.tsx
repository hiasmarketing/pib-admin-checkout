"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import PibLogo from "@/components/brand/PibLogo";

interface PublicOrder {
  id: string;
  status: "pending_payment" | "paid" | "payment_failed" | "canceled";
  quantity: number;
  totalAmountCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  turmaName: string | null;
  productName: string | null;
  couponCode: string | null;
  pagarmeDeclineCode: string | null;
  pagarmeFailureMessage: string | null;
  whatsappGroupUrl: string | null;
}

function isApiError(data: unknown): data is { error?: string } {
  return Boolean(data && typeof data === "object" && "error" in data);
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function ObrigadoContent() {
  const t = useTranslations("obrigado");
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    async function fetchOrder(): Promise<PublicOrder> {
      const response = await fetch(`/api/orders/${orderId}`);
      const data = (await response.json().catch(() => null)) as
        | PublicOrder
        | { error?: string }
        | null;

      if (!response.ok || !data || isApiError(data)) {
        throw new Error(isApiError(data) && data.error ? data.error : t("invalidOrder"));
      }

      return data as PublicOrder;
    }

    async function poll() {
      if (!isMounted) return;

      try {
        const data = await fetchOrder();
        if (!isMounted) return;

        setOrder(data);
        setIsLoading(false);

        if (data?.status === "pending_payment" && Date.now() - startedAt < POLL_TIMEOUT_MS) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t("loadError"));
          setIsLoading(false);
        }
      }
    }

    if (!orderId) {
      return;
    }

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [orderId, t]);

  const isPaid = order?.status === "paid";
  const isPending = order?.status === "pending_payment";
  const isFailed = order?.status === "payment_failed";
  const isCanceled = order?.status === "canceled";
  const visibleError = orderId ? error : t("missingOrder");
  const visibleIsLoading = orderId ? isLoading : false;

  function getPagarmeErrorMessage(o: PublicOrder): string {
    const code = o.pagarmeDeclineCode;
    if (code) {
      const pagarmeErrors = t.raw("pagarmeErrors") as Record<string, string> | undefined;
      if (pagarmeErrors && pagarmeErrors[code]) return pagarmeErrors[code];
    }
    return o.pagarmeFailureMessage ?? t("failedFallback");
  }

  function getTitle() {
    if (visibleError || isFailed || isCanceled) return t("failedTitle");
    if (visibleIsLoading || isPending) return t("processingTitle");
    if (isPaid) return "Obrigado!";
    return t("failedTitle");
  }

  function getSubtitle() {
    if (visibleError) return visibleError;
    if (visibleIsLoading || isPending) return t("processingMessage");
    if (isPaid) return "Te enviaremos um e-mail de confirmação da compra";
    if (isFailed) return getPagarmeErrorMessage(order!);
    if (isCanceled) return t("canceledMessage");
    return "";
  }

  const showError = !!visibleError || isFailed || isCanceled;

  return (
    <div className="min-h-screen bg-white flex flex-col text-[#2b3674]">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-12 max-w-[860px] w-full">
          <PibLogo size="md" priority />

          <div className="flex flex-col items-center gap-2 text-center w-full">
            <h1
              className="font-bold text-black leading-none"
              style={{
                fontFamily: "var(--font-inter-var), Montserrat, sans-serif",
                fontSize: "clamp(56px, 12vw, 132px)",
                letterSpacing: "-0.07em",
                color: showError ? "#dc2626" : "#000",
              }}
              role={showError ? "alert" : undefined}
            >
              {getTitle()}
            </h1>
            <p
              className="font-semibold text-sm md:text-base text-[#2b3674] max-w-xl"
              style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "-0.02em" }}
            >
              {getSubtitle()}
            </p>

            {isPaid && order && (
              <p
                className="text-xs md:text-sm text-[#a3aed0] mt-1"
                style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif" }}
              >
                {order.productName}
                {order.turmaName ? ` · ${order.turmaName}` : ""}
              </p>
            )}
          </div>

          {isPaid && order?.whatsappGroupUrl && (
            <a
              href={order.whatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-[860px] inline-flex items-center justify-center gap-2 h-[54px] rounded-[10px] bg-[#25D366] hover:bg-[#1eb85a] transition-colors text-white font-semibold text-sm"
              style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "-0.02em" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 32 32"
                fill="white"
                aria-hidden="true"
              >
                <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16c0 2.347.637 4.64 1.845 6.653L2.667 29.333l6.88-1.813A13.285 13.285 0 0016.004 29.333C23.36 29.333 29.333 23.36 29.333 16c0-7.36-5.973-13.333-13.329-13.333zm0 24c-2.133 0-4.24-.56-6.107-1.627l-.427-.253-4.08 1.067 1.093-3.96-.28-.44A10.613 10.613 0 015.333 16c0-5.88 4.787-10.667 10.671-10.667S26.667 10.12 26.667 16c0 5.88-4.787 10.667-10.663 10.667z" />
              </svg>
              {t("whatsappCta")}
            </a>
          )}

          {isPaid && !order?.whatsappGroupUrl && (
            <p className="max-w-xl text-sm text-[#a3aed0] text-center">
              {t("whatsappFallback")}
            </p>
          )}

          <Link
            href="/formulario"
            className="w-full max-w-[860px] inline-flex items-center justify-center h-[54px] rounded-[10px] bg-[#0077ff] hover:bg-[#0066dd] transition-colors text-white font-semibold text-sm"
            style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "-0.02em" }}
          >
            Voltar à página principal!
          </Link>
        </div>
      </main>

      <footer className="w-full border-t border-[#e0e5f2] py-6 px-6 md:px-16 lg:px-24">
        <div className="mx-auto max-w-[1920px] flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <p className="text-xs md:text-sm text-[#a3aed0] font-medium">
            © 2026. All Rights Reserved. Made by{" "}
            <span className="font-bold">PIB</span>
          </p>
          <nav className="flex flex-wrap gap-4 md:gap-6 text-xs md:text-sm font-semibold text-[#12372a]">
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

export default function ObrigadoPage() {
  return (
    <Suspense>
      <ObrigadoContent />
    </Suspense>
  );
}
