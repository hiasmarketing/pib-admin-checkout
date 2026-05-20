"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  CheckoutLayout,
  StepIndicator,
  PaymentStatusIndicator,
  type PaymentStatus,
} from "@/components/checkout";

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/DkqtIjnzA5sLTfeNsvJXMF";

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
  stripeDeclineCode: string | null;
  stripeFailureCode: string | null;
}

function isApiError(data: unknown): data is { error?: string } {
  return Boolean(data && typeof data === "object" && "error" in data);
}

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
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

  function getStripeErrorMessage(order: PublicOrder): string {
    const code = order.stripeDeclineCode ?? order.stripeFailureCode;
    if (!code) return t("failedFallback");

    const stripeErrors = t.raw("stripeErrors") as Record<string, string>;
    return stripeErrors[code] ?? t("failedFallback");
  }

  // Mapeamento para o componente de animação
  const indicatorStatus: PaymentStatus =
    isPaid
      ? "success"
      : isFailed || isCanceled || (!!visibleError && !visibleIsLoading)
        ? "error"
        : "loading";

  function getTitle() {
    if (visibleIsLoading || isPending) return t("processingTitle");
    if (isPaid) return t("paidTitle");
    if (isFailed) return t("failedTitle");
    if (isCanceled) return t("canceledTitle");
    return t("failedTitle");
  }

  function getMessage() {
    if (visibleError) return visibleError;
    if (visibleIsLoading || isPending) return t("processingMessage");
    if (isPaid) {
      const parts: string[] = [t("paidMessage")];
      if (order?.productName) parts.push(order.productName);
      if (order?.turmaName) parts.push(order.turmaName);
      if (order) {
        parts.push(
          `${formatAmount(order.totalAmountCents, order.currency)} · ${
            order.quantity === 1 ? "1 ingresso" : `${order.quantity} ingressos`
          }`,
        );
      }
      return parts;
    }
    if (isFailed) return getStripeErrorMessage(order!);
    if (isCanceled) return t("canceledMessage");
    return "";
  }

  const message = getMessage();
  const messageParts = Array.isArray(message) ? message : [message];

  return (
    <CheckoutLayout>
      <StepIndicator currentStep={3} />

      <div className="flex flex-col items-center text-center gap-6 py-4">
        <h1 className="text-white font-sora font-semibold text-lg md:text-xl leading-snug">
          {getTitle()}
        </h1>

        <PaymentStatusIndicator
          status={indicatorStatus}
          size={120}
          showLabel={false}
        />

        <div className="font-inter text-sm space-y-1">
          {messageParts.map((part, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? indicatorStatus === "error"
                    ? "text-red-400"
                    : "text-white/80"
                  : i === 1
                    ? "font-semibold text-white"
                    : "text-white/50 text-xs"
              }
              role={indicatorStatus === "error" && i === 0 ? "alert" : undefined}
            >
              {part}
            </p>
          ))}
        </div>

        {isPaid && (
          <div className="flex flex-col items-center gap-4">
            <p className="max-w-xl text-white font-sora font-semibold text-lg md:text-xl leading-snug">
              {t("whatsappIntro")}
            </p>

            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#25D366] hover:bg-[#1eb85a] transition-colors font-inter font-semibold text-sm text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 32 32"
                fill="white"
                aria-hidden="true"
              >
                <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16c0 2.347.637 4.64 1.845 6.653L2.667 29.333l6.88-1.813A13.285 13.285 0 0016.004 29.333C23.36 29.333 29.333 23.36 29.333 16c0-7.36-5.973-13.333-13.329-13.333zm0 24c-2.133 0-4.24-.56-6.107-1.627l-.427-.253-4.08 1.067 1.093-3.96-.28-.44A10.613 10.613 0 015.333 16c0-5.88 4.787-10.667 10.671-10.667S26.667 10.12 26.667 16c0 5.88-4.787 10.667-10.663 10.667zm5.84-7.973c-.32-.16-1.893-.933-2.187-1.04-.293-.107-.507-.16-.72.16-.213.32-.827 1.04-.987 1.227-.173.187-.347.213-.667.053-.32-.16-1.347-.493-2.56-1.573-.947-.84-1.587-1.88-1.773-2.2-.187-.32-.02-.493.14-.653.147-.147.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.987-2.373-.253-.613-.52-.533-.72-.547-.187-.013-.4-.013-.613-.013-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667s1.147 3.093 1.307 3.307c.16.213 2.24 3.413 5.44 4.787.76.333 1.347.533 1.813.68.76.24 1.453.2 2 .12.613-.093 1.893-.773 2.16-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373z" />
              </svg>
              {t("whatsappCta")}
            </a>
          </div>
        )}
      </div>
    </CheckoutLayout>
  );
}

export default function ObrigadoPage() {
  return (
    <Suspense>
      <ObrigadoContent />
    </Suspense>
  );
}
