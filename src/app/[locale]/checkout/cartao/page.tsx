"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from "@stripe/stripe-js";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckoutLayout,
  StepIndicator,
  InputField,
  MaskedInputField,
  Button,
} from "@/components/checkout";
import {
  loadCatalogSelection,
  loadTracking,
  resolveStoredSellerIdentifier,
} from "@/lib/tracking";
import { getAfterpayEligibility } from "@/lib/payments/afterpay";
import { formatSaoPauloDate } from "@/lib/timezone";
import {
  ensureCheckoutLeadId,
  getStoredCheckoutContact,
} from "@/lib/checkout/lead-session";

// ---------- types ----------

type PaymentMethod = "card" | "pix" | "klarna" | "afterpay_clearpay";

interface ProductOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unitAmountCents: number;
  currency: string;
  maxQuantity: number;
  installmentOptions: number[];
  isDefault: boolean;
  paymentMethods: PaymentMethod[];
}

interface TurmaOption {
  id: string;
  slug: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  products: ProductOption[];
}

interface QuotePricing {
  quantity: number;
  installmentCount: number;
  unitAmountCents: number;
  subtotalAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  chargedAmountCents?: number;
  chargedCurrency?: string;
  exchangeRate?: number | null;
  installmentBreakdown?: Array<{
    installments: number;
    totalCents: number;
    perInstallmentCents: number;
    interestRatePct: number | null;
    label: string;
  }>;
}

interface QuoteResult {
  turma: { id: string; name: string; slug: string };
  product: {
    id: string;
    name: string;
    description: string | null;
    unitAmountCents: number;
    currency: string;
    maxQuantity: number;
    installmentOptions: number[];
  };
  pricing: QuotePricing;
  coupon:
    | { applied: true; code: string; discountAmountCents: number }
    | { applied: false; reason: string }
    | null;
}

interface PixPaymentState {
  orderId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  code: string;
  expiresAt: number;
  imageUrlPng: string | null;
  imageUrlSvg: string | null;
  hostedInstructionsUrl: string | null;
}

interface LeadContact {
  name: string;
  email: string;
  phone: string;
}

interface AfterpayBillingAddress {
  country: string;
  postalCode: string;
  state: string;
  city: string;
  line1: string;
  line2: string;
}

// ---------- helpers ----------

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatCurrency(cents: number, currency: string = "brl"): string {
  const cur = currency.toUpperCase();
  return new Intl.NumberFormat(cur === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: cur,
  }).format(cents / 100);
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatTurmaDate(value: string): string {
  return formatSaoPauloDate(value);
}

function formatTurmaDateRange(startsAt: string, endsAt: string | null): string {
  const startDate = formatTurmaDate(startsAt);
  if (!endsAt) return startDate;

  const endDate = formatTurmaDate(endsAt);
  return endDate === startDate ? startDate : `${startDate} - ${endDate}`;
}

function localizedPath(locale: string, path: `/${string}`) {
  if (locale === "en") return `/en${path}`;
  return process.env.NODE_ENV === "development" ? `/pt${path}` : path;
}

function getAvailablePaymentMethods(
  product?: ProductOption | null,
  params?: {
    amountCents?: number;
    currency?: string;
    buyerCountry?: string;
    stripeAccountCountry?: string;
  }
): PaymentMethod[] {
  const productMethods = product?.paymentMethods ?? ["card"];
  const hasInstallments = product?.installmentOptions.some((option) => option > 1);
  const currency = (params?.currency ?? product?.currency ?? "").toLowerCase();
  const methods = productMethods.filter((method) => {
    if (method === "pix" && currency === "usd") return false;
    if (method === "klarna") return hasInstallments;
    if (method !== "afterpay_clearpay") return true;

    const eligibility = getAfterpayEligibility({
      amountCents: params?.amountCents ?? product?.unitAmountCents ?? 0,
      currency: params?.currency ?? product?.currency ?? "",
      buyerCountry: params?.buyerCountry ?? "US",
      stripeAccountCountry: params?.stripeAccountCountry ?? "US",
    });

    return eligibility.eligible;
  });

  return methods.length > 0 ? methods : ["card"];
}

function getDefaultBillingCountry(currency?: string) {
  return currency?.toLowerCase() === "brl" ? "BR" : "US";
}

function PixIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/pix-brand.svg"
      alt=""
      width={120}
      height={120}
      className={`object-contain ${className}`}
      aria-hidden="true"
    />
  );
}

function CardIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/card-brand.svg"
      alt=""
      width={120}
      height={120}
      className={`object-contain ${className}`}
      aria-hidden="true"
    />
  );
}

function KlarnaIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] bg-[#ffb3c7] px-1.5 py-0.5 text-[10px] font-black leading-none text-black ${className}`}
      aria-hidden="true"
    >
      K
    </span>
  );
}

function AfterpayIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] bg-[#b2fce4] px-1.5 py-0.5 text-[10px] font-black leading-none text-black ${className}`}
      aria-hidden="true"
    >
      AP
    </span>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-13.66 5.66M4 12A8 8 0 0 1 17.66 6.34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 18H4v-3M17 6h3v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M6 16a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CheckoutFormSkeleton() {
  return (
    <div className="animate-pulse space-y-4 mt-6">
      <div className="h-16 rounded-full bg-white/10" />
      <div className="h-16 rounded-2xl bg-white/10" />
      <div className="flex gap-3">
        <div className="h-14 flex-1 rounded-2xl bg-white/10" />
        <div className="h-14 flex-1 rounded-2xl bg-white/10" />
      </div>
      <div className="h-16 rounded-2xl bg-white/10" />
      <div className="h-16 rounded-2xl bg-white/10" />
      <div className="h-14 rounded-full bg-white/10 mt-4" />
    </div>
  );
}

// ---------- component ----------

export default function CartaoPage() {
  const t = useTranslations("cartao");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const paymentElementRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const isCurrencySelectionRoute = pathname.endsWith("/checkout");

  // Catalog
  const [turmaOptions, setTurmaOptions] = useState<TurmaOption[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sellerIdentifier] = useState<{
    sellerId: string | null;
    sellerSlug: string | null;
  }>(() => {
    if (typeof window === "undefined") return { sellerId: null, sellerSlug: null };
    const sel = loadCatalogSelection();
    const trk = loadTracking();
    return resolveStoredSellerIdentifier(sel, trk);
  });
  const [leadContact] = useState<LeadContact>(() => {
    if (typeof window === "undefined") return { name: "", email: "", phone: "" };
    return getStoredCheckoutContact() ?? { name: "", email: "", phone: "" };
  });
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeCouponCode, setActiveCouponCode] = useState("");

  // Form
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [coupon, setCoupon] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cardholderName, setCardholderName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [afterpayBillingAddress, setAfterpayBillingAddress] =
    useState<AfterpayBillingAddress>({
      country: "US",
      postalCode: "",
      state: "",
      city: "",
      line1: "",
      line2: "",
    });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isCreatingPix, setIsCreatingPix] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isPaymentElementComplete, setIsPaymentElementComplete] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [pixPayment, setPixPayment] = useState<PixPaymentState | null>(null);
  const [copiedPixCode, setCopiedPixCode] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState("");

  const isOrderPrepared = Boolean(clientSecret || pixPayment);
  const hasCatalogSelection = Boolean(selectedTurmaId && selectedProductId);
  const isIdentityValid = cpfCnpj.replace(/\D/g, "").length >= 11;
  const requiresCpfCnpj =
    paymentMethod !== "klarna" && paymentMethod !== "afterpay_clearpay";
  const afterpayBuyerCountry = afterpayBillingAddress.country.trim().toUpperCase();
  const afterpayEligibility = quote
    ? getAfterpayEligibility({
        amountCents: quote.pricing.totalAmountCents,
        currency: quote.product.currency,
        buyerCountry: afterpayBuyerCountry,
        stripeAccountCountry: "US",
      })
    : null;
  const isAfterpayBillingAddressValid =
    afterpayBillingAddress.country === "US" &&
    afterpayBillingAddress.postalCode.trim().length >= 5 &&
    afterpayBillingAddress.state.trim().length >= 2 &&
    afterpayBillingAddress.city.trim().length >= 2 &&
    afterpayBillingAddress.line1.trim().length >= 3;
  const canCreateOrder =
    (!requiresCpfCnpj || isIdentityValid) &&
    termsAccepted &&
    hasCatalogSelection &&
    !catalogLoading;
  const canConfirmPayment =
    paymentMethod === "card" &&
    canCreateOrder &&
    cardholderName.trim().length >= 3 &&
    isPaymentElementComplete;
  const canConfirmKlarnaPayment =
    paymentMethod === "klarna" &&
    canCreateOrder &&
    isPaymentElementComplete &&
    !isConfirmingPayment;
  const canConfirmAfterpayPayment =
    paymentMethod === "afterpay_clearpay" &&
    canCreateOrder &&
    isAfterpayBillingAddressValid &&
    Boolean(afterpayEligibility?.eligible) &&
    isPaymentElementComplete &&
    !isConfirmingPayment;
  const canCreatePixPayment =
    paymentMethod === "pix" && canCreateOrder && !isCreatingPix;
  const pixSecondsRemaining = pixPayment
    ? Math.max(0, pixPayment.expiresAt - nowSeconds)
    : 0;
  const isPixExpired = Boolean(pixPayment && pixSecondsRemaining <= 0);

  // Mount: guard lead, load catalog
  useEffect(() => {
    window.queueMicrotask(() => {
      void (async () => {
        const leadId = await ensureCheckoutLeadId();
        if (!leadId) {
          router.replace(localizedPath(locale, "/formulario"));
          return;
        }

        const selection = loadCatalogSelection();
        await initCatalog(
          selection?.turmaId ?? null,
          selection?.turmaSlug ?? null,
          selection?.productId ?? null,
          selection?.productSlug ?? null
        );
      })();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCurrencySelectionRoute || catalogLoading) return;
    if (quote?.product.currency?.toLowerCase() === "brl") {
      router.replace(localizedPath(locale, "/checkout/pagarme"));
    }
  }, [catalogLoading, isCurrencySelectionRoute, locale, quote?.product.currency, router]);

  // Reset paymentMethod when product changes and current method is no longer available
  useEffect(() => {
    if (!selectedProductId) return;
    const product = turmaOptions
      .flatMap((t) => t.products)
      .find((p) => p.id === selectedProductId);
    const methods = getAvailablePaymentMethods(product, {
      amountCents: quote?.pricing.totalAmountCents,
      currency: quote?.product.currency,
      buyerCountry: afterpayBillingAddress.country,
      stripeAccountCountry: "US",
    });
    if (product && !methods.includes(paymentMethod)) {
      window.queueMicrotask(() => {
        setPaymentMethod(methods[0] ?? "card");
      });
    }
  }, [selectedProductId, turmaOptions, quote, afterpayBillingAddress.country]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function initCatalog(
    turmaId: string | null,
    turmaSlug: string | null,
    productId: string | null,
    productSlug: string | null
  ) {
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/catalog/options");
      if (!res.ok) return;
      const data = (await res.json()) as { options?: TurmaOption[] };
      const options = data.options ?? [];
      setTurmaOptions(options);

      let tid: string | null = null;
      let pid: string | null = null;

      if (turmaId) {
        const found = options.find((o) => o.id === turmaId);
        if (found) {
          tid = found.id;
          const prod = productId
            ? found.products.find((p) => p.id === productId)
            : null;
          pid =
            prod?.id ??
            found.products.find((p) => p.isDefault)?.id ??
            found.products[0]?.id ??
            null;
        }
      } else if (turmaSlug) {
        const found = options.find((o) => o.slug === turmaSlug);
        if (found) {
          tid = found.id;
          const prod = productSlug
            ? found.products.find((p) => p.slug === productSlug)
            : null;
          pid =
            prod?.id ??
            found.products.find((p) => p.isDefault)?.id ??
            found.products[0]?.id ??
            null;
        }
      } else if (options.length === 1) {
        tid = options[0].id;
        pid =
          options[0].products.find((p) => p.isDefault)?.id ??
          options[0].products[0]?.id ??
          null;
      }

      if (tid) setSelectedTurmaId(tid);
      if (pid) setSelectedProductId(pid);

      if (tid && pid) {
        await doFetchQuote(tid, pid, 1, 1, "");
      }
    } catch {
      // catalog unavailable — fallback to env pricing
    } finally {
      setCatalogLoading(false);
    }
  }

  async function doFetchQuote(
    tid: string,
    pid: string,
    qty: number,
    inst: number,
    couponCode: string
  ): Promise<QuoteResult | null> {
    try {
      const res = await fetch("/api/catalog/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turmaId: tid,
          productId: pid,
          quantity: qty,
          installmentCount: inst,
          couponCode: couponCode || undefined,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as QuoteResult;
      setQuote(data);
      return data;
    } catch {
      return null;
    }
  }

  async function handleQuantityChange(newQty: number) {
    setQuantity(newQty);
    if (selectedTurmaId && selectedProductId) {
      await doFetchQuote(
        selectedTurmaId,
        selectedProductId,
        newQty,
        1,
        activeCouponCode
      );
    }
  }

  async function handleApplyCoupon() {
    if (!selectedTurmaId || !selectedProductId) return;
    const result = await doFetchQuote(
      selectedTurmaId,
      selectedProductId,
      quantity,
      1,
      coupon
    );
    if (result?.coupon?.applied) {
      setActiveCouponCode(coupon);
    } else {
      setActiveCouponCode("");
    }
  }

  async function handleTurmaChange(tid: string) {
    const turma = turmaOptions.find((o) => o.id === tid);
    if (!turma) return;
    const pid =
      turma.products.find((p) => p.isDefault)?.id ??
      turma.products[0]?.id ??
      null;
    setSelectedTurmaId(tid);
    setSelectedProductId(pid);
    setQuantity(1);
    setCoupon("");
    setActiveCouponCode("");
    setQuote(null);
    if (pid) await doFetchQuote(tid, pid, 1, 1, "");
  }

  async function handleProductChange(pid: string) {
    if (!selectedTurmaId) return;
    setSelectedProductId(pid);
    setQuantity(1);
    setCoupon("");
    setActiveCouponCode("");
    setQuote(null);
    await doFetchQuote(selectedTurmaId, pid, 1, 1, "");
  }

  async function handlePaymentMethodChange(method: PaymentMethod) {
    if (isOrderPrepared  || isCreatingPix) return;

    setPaymentMethod(method);
    setError("");
    if (method !== "card") {
      if (selectedTurmaId && selectedProductId) {
        await doFetchQuote(
          selectedTurmaId,
          selectedProductId,
          quantity,
          1,
          activeCouponCode
        );
      }
    }
  }

  async function handleCurrencyChoice(method: "usd" | "brl") {
    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace(localizedPath(locale, "/formulario"));
      return;
    }

    router.push(
      localizedPath(
        locale,
        method === "usd" ? "/checkout/cartao" : "/checkout/pagarme"
      )
    );
  }

  function updateAfterpayBillingAddress(
    field: keyof AfterpayBillingAddress,
    value: string
  ) {
    setAfterpayBillingAddress((current) => ({
      ...current,
      [field]: field === "country" || field === "state" ? value.toUpperCase() : value,
    }));
    setError("");
  }

  // Stripe payment element
  useEffect(() => {
    const paymentQuote = quote;
    const paymentAmountCents = paymentQuote?.pricing.totalAmountCents ?? 0;

    if (
      (
        paymentMethod !== "card" &&
        paymentMethod !== "klarna" &&
        paymentMethod !== "afterpay_clearpay"
      ) ||
      !paymentElementRef.current ||
      !stripePromise ||
      !paymentQuote ||
      paymentAmountCents <= 0
    ) {
      return;
    }

    const paymentCurrency = paymentQuote.product.currency;
    const stripePaymentMethod = paymentMethod;
    let isMounted = true;
    let paymentElement: StripePaymentElement | null = null;
    setIsPaymentElementComplete(false);

    async function mountPaymentElement() {
      const stripe = await stripePromise;
      if (!stripe || !isMounted || !paymentElementRef.current) {
        setError(t("stripeLoadError"));
        return;
      }
      const elements = stripe.elements({
        mode: "payment",
        amount: paymentAmountCents,
        currency: paymentCurrency,
        paymentMethodTypes: [stripePaymentMethod],
        locale: locale.startsWith("en") ? "en" : "pt-BR",
        appearance: {
          theme: "night",
          labels: "above",
          variables: {
            colorPrimary: "#f318ff",
            colorBackground: "#000000",
            colorText: "#ffffff",
            colorTextSecondary: "rgba(255, 255, 255, 0.72)",
            colorTextPlaceholder: "#828282",
            colorDanger: "#fca5a5",
            fontFamily: "Inter, system-ui, sans-serif",
            borderRadius: "16px",
            spacingUnit: "6px",
            gridRowSpacing: "18px",
            gridColumnSpacing: "12px",
            focusBoxShadow: "0 0 0 1px #f318ff",
          },
          rules: {
            ".Input": {
              border: "1px solid #ffffff",
              padding: "16px 24px",
              backgroundColor: "#000000",
              boxShadow: "none",
            },
            ".Input:focus": {
              borderColor: "#f318ff",
              boxShadow: "0 0 0 1px #f318ff",
            },
            ".Label": {
              color: "#ffffff",
              fontWeight: "500",
              marginBottom: "8px",
            },
            ".Tab": {
              border: "1px solid rgba(255, 255, 255, 0.2)",
              backgroundColor: "#000000",
              borderRadius: "16px",
            },
            ".Tab--selected": {
              borderColor: "#f318ff",
              boxShadow: "0 0 0 1px #f318ff",
            },
          },
        },
      });
      paymentElement = elements.create("payment", {
        layout: "tabs",
        paymentMethodOrder: [stripePaymentMethod],
        fields: {
          billingDetails: {
            name: "never",
            email: stripePaymentMethod !== "card" ? "never" : "auto",
            phone: stripePaymentMethod !== "card" ? "never" : "auto",
            address:
              stripePaymentMethod === "klarna"
                ? {
                    country: "never",
                    postalCode: "auto",
                    state: "auto",
                    city: "auto",
                    line1: "auto",
                    line2: "auto",
                  }
                : stripePaymentMethod === "afterpay_clearpay"
                  ? {
                      country: "never",
                      postalCode: "never",
                      state: "never",
                      city: "never",
                      line1: "never",
                      line2: "never",
                    }
                  : "auto",
          },
        },
        wallets: {
          applePay: "never",
          googlePay: "never",
          link: "never",
        },
      });
      paymentElement.on("change", (event) => {
        setIsPaymentElementComplete(event.complete);
      });
      paymentElement.mount(paymentElementRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
    }

    mountPaymentElement();

    return () => {
      isMounted = false;
      paymentElement?.unmount();
      elementsRef.current = null;
      stripeRef.current = null;
      setIsPaymentElementComplete(false);
    };
  }, [locale, paymentMethod, quote, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (paymentMethod === "pix") {
      await handleCreatePixPayment();
      return;
    }

    if (paymentMethod === "klarna") {
      await handleConfirmKlarnaPayment();
      return;
    }

    if (paymentMethod === "afterpay_clearpay") {
      await handleConfirmAfterpayPayment();
      return;
    }

    await handleConfirmCardPayment();
  }

  async function handleConfirmCardPayment() {
    if (
      !stripeRef.current ||
      !elementsRef.current ||
      !canConfirmPayment ||
      isConfirmingPayment
    ) {
      return;
    }

    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace(localizedPath(locale, "/formulario"));
      return;
    }

    setError("");
    setIsConfirmingPayment(true);

    try {
      const submitResult = await elementsRef.current.submit();

      if (submitResult.error) {
        setError(submitResult.error.message ?? t("paymentError"));
        return;
      }

      const confirmationResult = await stripeRef.current.createConfirmationToken({
        elements: elementsRef.current,
        params: {
          payment_method_data: {
            billing_details: {
              name: cardholderName.trim(),
            },
          },
        },
      });

      if (confirmationResult.error) {
        setError(confirmationResult.error.message ?? t("paymentError"));
        return;
      }

      const body: Record<string, unknown> = {
        leadId,
        quantity,
        installmentCount: effectiveInstallment,
        couponCode: activeCouponCode || undefined,
        cpfCnpj,
        confirmationTokenId: confirmationResult.confirmationToken.id,
        returnUrl: `${window.location.origin}${localizedPath(locale, "/obrigado")}`,
      };
      if (selectedTurmaId) body.turmaId = selectedTurmaId;
      if (selectedProductId) body.productId = selectedProductId;
      if (sellerIdentifier.sellerId) body.sellerId = sellerIdentifier.sellerId;
      if (sellerIdentifier.sellerSlug) body.sellerSlug = sellerIdentifier.sellerSlug;

      const response = await fetch("/api/checkout/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            clientSecret?: string;
            status?: string;
            error?: string;
            stripeDeclineCode?: string | null;
            stripeFailureCode?: string | null;
          }
        | null;

      if (data?.orderId && data.status === "payment_failed") {
        sessionStorage.setItem("destiny_order_id", data.orderId);
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      if (!response.ok || !data?.orderId || !data?.clientSecret) {
        setError(data?.error ?? t("paymentError"));
        return;
      }

      sessionStorage.setItem("destiny_order_id", data.orderId);
      setClientSecret(data.clientSecret);

      if (data.status === "requires_action") {
        const nextActionResult = await stripeRef.current.handleNextAction({
          clientSecret: data.clientSecret,
        });

        if (nextActionResult.error) {
          setError(nextActionResult.error.message ?? t("paymentError"));
          return;
        }

        const nextStatus = nextActionResult.paymentIntent?.status;
        if (nextStatus === "succeeded" || nextStatus === "processing") {
          router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
          return;
        }
      }

      if (data.status === "succeeded" || data.status === "processing") {
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      setError(t("paymentError"));
    } catch {
      setError(t("paymentError"));
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  async function handleCreatePixPayment(options?: { replaceExisting?: boolean }) {
    if (!canCreatePixPayment || (pixPayment && !options?.replaceExisting)) return;

    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace(localizedPath(locale, "/formulario"));
      return;
    }

    setError("");
    setIsCreatingPix(true);
    setCopiedPixCode(false);

    try {
      const response = await fetch("/api/checkout/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          quantity,
          couponCode: activeCouponCode || undefined,
          cpfCnpj,
          turmaId: selectedTurmaId,
          productId: selectedProductId,
          sellerId: sellerIdentifier.sellerId || undefined,
          sellerSlug: sellerIdentifier.sellerSlug || undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            paymentIntentId?: string;
            amountCents?: number;
            currency?: string;
            pix?: {
              code?: string;
              expiresAt?: number;
              imageUrlPng?: string | null;
              imageUrlSvg?: string | null;
              hostedInstructionsUrl?: string | null;
            };
            error?: string;
          }
        | null;

      if (
        !response.ok ||
        !data?.orderId ||
        !data.paymentIntentId ||
        !data.pix?.code ||
        !data.pix.expiresAt
      ) {
        setError(data?.error ?? t("pixError"));
        return;
      }

      sessionStorage.setItem("destiny_order_id", data.orderId);
      setPixPayment({
        orderId: data.orderId,
        paymentIntentId: data.paymentIntentId,
        amountCents: data.amountCents ?? totalAmountCents,
        currency: data.currency ?? quote?.product.currency ?? "brl",
        code: data.pix.code,
        expiresAt: data.pix.expiresAt,
        imageUrlPng: data.pix.imageUrlPng ?? null,
        imageUrlSvg: data.pix.imageUrlSvg ?? null,
        hostedInstructionsUrl: data.pix.hostedInstructionsUrl ?? null,
      });
      setNowSeconds(Math.floor(Date.now() / 1000));
    } catch {
      setError(t("pixError"));
    } finally {
      setIsCreatingPix(false);
    }
  }

  async function handleConfirmKlarnaPayment() {
    if (
      !stripeRef.current ||
      !elementsRef.current ||
      !canConfirmKlarnaPayment ||
      isConfirmingPayment
    ) {
      return;
    }

    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace(localizedPath(locale, "/formulario"));
      return;
    }

    setError("");
    setIsConfirmingPayment(true);

    const returnUrl = `${window.location.origin}${localizedPath(locale, "/obrigado")}`;

    try {
      const submitResult = await elementsRef.current.submit();

      if (submitResult.error) {
        setError(submitResult.error.message ?? t("klarnaError"));
        return;
      }

      const confirmationResult = await stripeRef.current.createConfirmationToken({
        elements: elementsRef.current,
        params: {
          payment_method_data: {
            billing_details: {
              name: leadContact.name,
              email: leadContact.email,
              phone: leadContact.phone,
              address: {
                country: getDefaultBillingCountry(quote?.product.currency),
              },
            },
          },
          return_url: returnUrl,
        },
      });

      if (confirmationResult.error) {
        setError(confirmationResult.error.message ?? t("klarnaError"));
        return;
      }

      const response = await fetch("/api/checkout/klarna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          quantity,
          couponCode: activeCouponCode || undefined,
          turmaId: selectedTurmaId,
          productId: selectedProductId,
          sellerId: sellerIdentifier.sellerId || undefined,
          sellerSlug: sellerIdentifier.sellerSlug || undefined,
          confirmationTokenId: confirmationResult.confirmationToken.id,
          returnUrl,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            clientSecret?: string;
            status?: string;
            error?: string;
          }
        | null;

      if (data?.orderId && data.status === "payment_failed") {
        sessionStorage.setItem("destiny_order_id", data.orderId);
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      if (!response.ok || !data?.orderId || !data?.clientSecret) {
        setError(data?.error ?? t("klarnaError"));
        return;
      }

      sessionStorage.setItem("destiny_order_id", data.orderId);
      setClientSecret(data.clientSecret);

      if (data.status === "requires_action") {
        const nextActionResult = await stripeRef.current.handleNextAction({
          clientSecret: data.clientSecret,
        });

        if (nextActionResult.error) {
          setError(nextActionResult.error.message ?? t("klarnaError"));
          return;
        }

        const nextStatus = nextActionResult.paymentIntent?.status;
        if (nextStatus === "succeeded" || nextStatus === "processing") {
          router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
          return;
        }
      }

      if (data.status === "succeeded" || data.status === "processing") {
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      setError(t("klarnaError"));
    } catch {
      setError(t("klarnaError"));
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  async function handleConfirmAfterpayPayment() {
    if (
      !stripeRef.current ||
      !elementsRef.current ||
      !canConfirmAfterpayPayment ||
      isConfirmingPayment
    ) {
      return;
    }

    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace(localizedPath(locale, "/formulario"));
      return;
    }

    if (!isAfterpayBillingAddressValid) {
      setError(t("afterpayAddressError"));
      return;
    }

    if (!afterpayEligibility?.eligible) {
      setError(t("afterpayUnavailable"));
      return;
    }

    setError("");
    setIsConfirmingPayment(true);

    const returnUrl = `${window.location.origin}${localizedPath(locale, "/obrigado")}`;
    const billingAddress = {
      country: afterpayBillingAddress.country,
      postal_code: afterpayBillingAddress.postalCode.trim(),
      state: afterpayBillingAddress.state.trim().toUpperCase(),
      city: afterpayBillingAddress.city.trim(),
      line1: afterpayBillingAddress.line1.trim(),
      line2: afterpayBillingAddress.line2.trim() || undefined,
    };
    const shippingAddress = {
      ...billingAddress,
      line2: afterpayBillingAddress.line2.trim() || null,
    };

    try {
      const submitResult = await elementsRef.current.submit();

      if (submitResult.error) {
        setError(submitResult.error.message ?? t("afterpayError"));
        return;
      }

      const confirmationResult = await stripeRef.current.createConfirmationToken({
        elements: elementsRef.current,
        params: {
          payment_method_data: {
            billing_details: {
              name: leadContact.name,
              email: leadContact.email,
              phone: leadContact.phone,
              address: billingAddress,
            },
          },
          shipping: {
            name: leadContact.name || null,
            phone: leadContact.phone || null,
            address: shippingAddress,
          },
          return_url: returnUrl,
        },
      });

      if (confirmationResult.error) {
        setError(confirmationResult.error.message ?? t("afterpayError"));
        return;
      }

      const response = await fetch("/api/checkout/afterpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          quantity,
          couponCode: activeCouponCode || undefined,
          cpfCnpj: cpfCnpj || undefined,
          turmaId: selectedTurmaId,
          productId: selectedProductId,
          sellerId: sellerIdentifier.sellerId || undefined,
          sellerSlug: sellerIdentifier.sellerSlug || undefined,
          confirmationTokenId: confirmationResult.confirmationToken.id,
          returnUrl,
          buyerCountry: afterpayBillingAddress.country,
          billingAddress: {
            country: afterpayBillingAddress.country,
            postalCode: afterpayBillingAddress.postalCode.trim(),
            state: afterpayBillingAddress.state.trim().toUpperCase(),
            city: afterpayBillingAddress.city.trim(),
            line1: afterpayBillingAddress.line1.trim(),
            line2: afterpayBillingAddress.line2.trim() || undefined,
          },
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            clientSecret?: string;
            status?: string;
            error?: string;
          }
        | null;

      if (data?.orderId && data.status === "payment_failed") {
        sessionStorage.setItem("destiny_order_id", data.orderId);
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      if (!response.ok || !data?.orderId || !data?.clientSecret) {
        setError(data?.error ?? t("afterpayError"));
        return;
      }

      sessionStorage.setItem("destiny_order_id", data.orderId);
      setClientSecret(data.clientSecret);

      if (data.status === "requires_action") {
        const nextActionResult = await stripeRef.current.handleNextAction({
          clientSecret: data.clientSecret,
        });

        if (nextActionResult.error) {
          setError(nextActionResult.error.message ?? t("afterpayError"));
          return;
        }

        const nextStatus = nextActionResult.paymentIntent?.status;
        if (nextStatus === "succeeded" || nextStatus === "processing") {
          router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
          return;
        }
      }

      if (data.status === "succeeded" || data.status === "processing") {
        router.push(`${localizedPath(locale, "/obrigado")}?orderId=${data.orderId}`);
        return;
      }

      setError(t("afterpayError"));
    } catch {
      setError(t("afterpayError"));
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  async function handleRegeneratePix() {
    if (!pixPayment) return;
    setPixPayment(null);
    await handleCreatePixPayment({ replaceExisting: true });
  }

  async function handleCopyPixCode() {
    if (!pixPayment?.code) return;

    try {
      await navigator.clipboard.writeText(pixPayment.code);
      setCopiedPixCode(true);
      window.setTimeout(() => setCopiedPixCode(false), 2000);
    } catch {
      setError(t("copyError"));
    }
  }

  // Derived display values
  const selectedTurma = turmaOptions.find((o) => o.id === selectedTurmaId);
  const selectedProduct = selectedTurma?.products.find(
    (p) => p.id === selectedProductId
  );
  const cardInstallmentOptions = [1];
  const effectiveInstallment = 1;
  const maxQuantity = Math.min(
    quote?.product.maxQuantity ?? selectedProduct?.maxQuantity ?? 5,
    10
  );
  const totalAmountCents = quote?.pricing.totalAmountCents ?? 0;
  const availablePaymentMethods = getAvailablePaymentMethods(selectedProduct, {
    amountCents: totalAmountCents || selectedProduct?.unitAmountCents,
    currency: quote?.product.currency ?? selectedProduct?.currency,
    buyerCountry: afterpayBillingAddress.country,
    stripeAccountCountry: "US",
  });
  const badgeLabel =
    quote?.turma.name ??
    (turmaOptions.length === 1 ? turmaOptions[0].name : null) ??
    null;
  const pixQrImageUrl = pixPayment?.imageUrlSvg ?? pixPayment?.imageUrlPng ?? null;

  if (isCurrencySelectionRoute) {
    const isRedirectingToBrl =
      !catalogLoading && quote?.product.currency?.toLowerCase() === "brl";

    return (
      <CheckoutLayout>
        <StepIndicator currentStep={2} />

        {catalogLoading || isRedirectingToBrl ? (
          <CheckoutFormSkeleton />
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
            {!catalogLoading && (
              <div className="mb-2">
                <h2 className="text-white font-sora font-bold text-lg text-center mb-4">
                  Selecione a sua turma
                </h2>
                {badgeLabel && (
                  <div className="border border-brand/40 rounded-full w-full px-8 py-5 text-center">
                    <p className="text-white font-sora font-bold text-sm md:text-base">
                      {badgeLabel}
                    </p>
                    {selectedTurma?.startsAt && (
                      <p className="text-white/60 font-inter text-sm mt-0.5">
                        {formatTurmaDateRange(selectedTurma.startsAt, selectedTurma.endsAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <h1 className="text-center font-sora text-2xl font-extrabold leading-tight text-white md:text-3xl">
              Escolha a moeda do pagamento
            </h1>

            {quote ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleCurrencyChoice("usd")}
                  className="flex min-h-[164px] cursor-pointer flex-col items-center justify-center gap-6 rounded-2xl border-2 border-white/15 bg-black/40 p-6 text-center transition-all hover:border-brand hover:bg-white/[0.03]"
                >
                  <span className="flex flex-col items-center gap-2">
                    <span className="font-sora text-xl font-extrabold text-white">
                      Pagar em Dólar
                    </span>
                    <span className="font-inter text-xs font-medium leading-snug text-white/60 md:text-sm">
                      À vista ou parcelado com Klarna ou Afterpay
                    </span>
                  </span>
                  <span className="rounded-full bg-brand px-6 py-2 font-inter text-sm font-semibold text-white">
                    Continuar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCurrencyChoice("brl")}
                  className="flex min-h-[164px] cursor-pointer flex-col items-center justify-center gap-6 rounded-2xl border-2 border-white/15 bg-black/40 p-6 text-center transition-all hover:border-brand hover:bg-white/[0.03]"
                >
                  <span className="flex flex-col items-center gap-2">
                    <span className="font-sora text-xl font-extrabold text-white">
                      Pagar em Real
                    </span>
                    <span className="font-inter text-xs font-medium leading-snug text-white/60 md:text-sm">
                      À vista ou parcelado
                    </span>
                  </span>
                  <span className="rounded-full bg-brand px-6 py-2 font-inter text-sm font-semibold text-white">
                    Continuar
                  </span>
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-center font-inter text-sm text-red-200">
                Não foi possível carregar os preços agora.
              </p>
            )}

          </div>
        )}
      </CheckoutLayout>
    );
  }

  if (pixPayment) {
    return (
      <CheckoutLayout>
        <StepIndicator currentStep={2} />

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <h1 className="max-w-4xl text-white font-sora font-extrabold text-2xl md:text-4xl leading-tight mb-10">
            {t("pixInstructions")}
          </h1>

          <div className="relative flex min-h-[360px] w-full max-w-[720px] items-center justify-center rounded-[32px] bg-[#1b1b1b] p-8 md:min-h-[520px] md:rounded-[56px]">
            <div className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.28),transparent_42%)]" />
            {isPixExpired ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isCreatingPix}
                onClick={handleRegeneratePix}
              >
                <span className="inline-flex items-center justify-center gap-4 rounded-full border-2 border-brand px-8 py-4 text-white font-sora text-lg font-extrabold uppercase md:px-16 md:text-2xl">
                  <RefreshIcon className="h-8 w-8" />
                  {isCreatingPix ? t("pixGenerating") : t("pixTryAgain")}
                </span>
              </Button>
            ) : (
              <div className="relative flex flex-col items-center gap-8">
                {pixQrImageUrl ? (
                  // Stripe returns a short-lived external QR image URL; keep it unoptimized.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pixQrImageUrl}
                    alt={t("pixQrAlt")}
                    className="h-44 w-44 bg-white p-3 md:h-56 md:w-56"
                  />
                ) : (
                  <div className="grid h-44 w-44 grid-cols-8 gap-1 bg-white p-3 md:h-56 md:w-56">
                    {Array.from({ length: 64 }, (_, index) => (
                      <span
                        key={index}
                        className={
                          pixPayment.code.charCodeAt(index % pixPayment.code.length) % 2
                            ? "bg-black"
                            : "bg-white"
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPixExpired && (
            <button
              type="button"
              onClick={handleCopyPixCode}
            className="mt-8 flex w-full max-w-sm cursor-pointer items-center justify-between gap-4 rounded-none bg-white px-5 py-4 text-left font-inter text-black transition-opacity hover:opacity-90"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold md:text-base">
                  {copiedPixCode ? t("pixCopied") : t("pixCopy")}
                </span>
                <span className="block truncate text-sm font-semibold text-black/45">
                  {pixPayment.code}
                </span>
              </span>
              <CopyIcon className="h-6 w-6 flex-shrink-0 text-brand" />
            </button>
          )}

          <div className="mt-8 font-sora font-extrabold text-white text-2xl leading-tight">
            <p>{t("pixTimeLabel")}</p>
            <p className={isPixExpired ? "text-brand text-3xl md:text-4xl" : ""}>
              {isPixExpired ? t("pixExpired") : formatCountdown(pixSecondsRemaining)}
            </p>
          </div>

          <p className="mt-4 text-sm text-white/60 font-inter">
            {formatCurrency(pixPayment.amountCents, pixPayment.currency)}
          </p>

          {error && (
            <p className="mt-4 text-sm text-red-300 font-inter" role="alert">
              {error}
            </p>
          )}
        </div>
      </CheckoutLayout>
    );
  }

  return (
    <CheckoutLayout>
      <StepIndicator currentStep={2} />

      {catalogLoading && !isOrderPrepared ? (
        <CheckoutFormSkeleton />
      ) : (
      <>
      {/* Turma section */}
        <div className="mb-6">
          <h2 className="text-white font-sora font-bold text-lg text-center mb-4">
            Selecione a sua turma
          </h2>
          {turmaOptions.length > 1 ? (
            <div className="border border-brand/40 bg-[#1e1e1e] rounded-2xl px-6 py-4 min-h-[56px]">
              <select
                value={selectedTurmaId ?? ""}
                onChange={(e) => handleTurmaChange(e.target.value)}
                disabled={isOrderPrepared}
                className="bg-transparent text-white outline-none w-full text-sm md:text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="" disabled className="bg-[#1e1e1e]">
                  Selecione...
                </option>
                {turmaOptions.map((turma) => (
                  <option key={turma.id} value={turma.id} className="bg-[#1e1e1e]">
                    {turma.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="border border-brand/40 rounded-full w-full px-8 py-5 text-center">
              {badgeLabel && (
                <p className="text-white font-sora font-bold text-sm md:text-base">
                  {badgeLabel}
                </p>
              )}
              {selectedTurma?.startsAt && (
                <p className="text-white/60 font-inter text-sm mt-0.5">
                  {formatTurmaDateRange(selectedTurma.startsAt, selectedTurma.endsAt)}
                </p>
              )}
            </div>
          )}
        </div>

      {availablePaymentMethods.length > 1 && (
        <div className="mb-8 flex flex-col items-center gap-4">
          <p className="text-white font-inter font-medium text-sm md:text-base">
            {t("paymentMethod")}
          </p>
          <div
            className={`grid gap-3 w-full ${
              availablePaymentMethods.length >= 4
                ? "max-w-2xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : availablePaymentMethods.length === 3
                  ? "max-w-2xl grid-cols-1 sm:grid-cols-3"
                  : availablePaymentMethods.length === 2
                    ? "max-w-xl grid-cols-2"
                    : "max-w-xl grid-cols-1"
            }`}
          >
            {availablePaymentMethods.includes("card") && (
              <button
                type="button"
                onClick={() => handlePaymentMethodChange("card")}
                disabled={isOrderPrepared || isCreatingPix}
                className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-5 font-inter text-sm font-semibold transition-all ${
                  paymentMethod === "card"
                    ? "border-brand text-white shadow-[0_0_0_1px_rgba(243,24,255,0.55)]"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-brand/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={paymentMethod === "card"}
              >
                <CardIcon className="h-5 w-5 text-brand" />
                {t("tabCard")}
              </button>
            )}
            {availablePaymentMethods.includes("pix") && (
              <button
                type="button"
                onClick={() => handlePaymentMethodChange("pix")}
                disabled={isOrderPrepared || isCreatingPix}
                className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-5 font-inter text-sm font-semibold transition-all ${
                  paymentMethod === "pix"
                    ? "border-brand text-white shadow-[0_0_0_1px_rgba(243,24,255,0.55)]"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-brand/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={paymentMethod === "pix"}
              >
                <PixIcon className="h-5 w-5 text-brand" />
                {t("tabPix")}
              </button>
            )}
            {availablePaymentMethods.includes("klarna") && (
              <button
                type="button"
                onClick={() => handlePaymentMethodChange("klarna")}
                disabled={isOrderPrepared || isCreatingPix}
                className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-4 font-inter text-sm font-semibold transition-all ${
                  paymentMethod === "klarna"
                    ? "border-brand text-white shadow-[0_0_0_1px_rgba(243,24,255,0.55)]"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-brand/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={paymentMethod === "klarna"}
              >
                <KlarnaIcon className="h-5" />
                {t("tabKlarna")}
              </button>
            )}
            {availablePaymentMethods.includes("afterpay_clearpay") && (
              <button
                type="button"
                onClick={() => handlePaymentMethodChange("afterpay_clearpay")}
                disabled={isOrderPrepared || isCreatingPix}
                className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-4 font-inter text-sm font-semibold transition-all ${
                  paymentMethod === "afterpay_clearpay"
                    ? "border-brand text-white shadow-[0_0_0_1px_rgba(243,24,255,0.55)]"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-brand/60"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={paymentMethod === "afterpay_clearpay"}
              >
                <AfterpayIcon className="h-5" />
                {t("tabAfterpay")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Product selector — only when turma has multiple products */}
      {selectedTurma && selectedTurma.products.length > 1 && (
        <div className="flex flex-col gap-2 mb-5">
          <label className="text-white font-inter font-medium text-sm md:text-base">
            Selecione o ingresso
          </label>
          <div className="border border-white rounded-2xl px-6 py-4 min-h-[56px]">
            <select
              value={selectedProductId ?? ""}
              onChange={(e) => handleProductChange(e.target.value)}
              disabled={isOrderPrepared }
              className="bg-transparent text-white outline-none w-full text-sm md:text-base disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedTurma.products.map((prod) => (
                <option key={prod.id} value={prod.id} className="bg-black">
                  {prod.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl flex-col gap-5"
        noValidate
      >
        {/* Coupon */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-end">
          <div className="min-w-0">
            <InputField
              id="coupon"
              label={t("coupon")}
              placeholder={t("couponPlaceholder")}
              value={coupon}
              onChange={setCoupon}
              disabled={isOrderPrepared }
            />
          </div>
          <div className="md:pb-[1px]">
            <Button
              type="button"
              variant="primary"
              onClick={handleApplyCoupon}
              fullWidth
              disabled={
                !coupon.trim() ||
                !selectedTurmaId ||
                catalogLoading ||
                isOrderPrepared
              }
            >
              {t("couponApply")}
            </Button>
          </div>
        </div>

        {/* Coupon feedback */}
        {quote?.coupon && (
          <p
            className={`text-sm font-inter -mt-2 ${
              quote.coupon.applied ? "text-green-400" : "text-red-300"
            }`}
          >
            {quote.coupon.applied
              ? `Cupom aplicado: −${formatCurrency(quote.coupon.discountAmountCents, quote.product.currency)}`
              : "Cupom inválido ou fora do escopo."}
          </p>
        )}

        {/* Quantity */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="quantity"
            className="text-white font-inter font-medium text-sm md:text-base"
          >
            {t("quantity")}
          </label>
          <div className="border border-white rounded-2xl px-6 py-4 min-h-[56px]">
            <select
              id="quantity"
              value={String(quantity)}
              onChange={(e) => handleQuantityChange(Number(e.target.value))}
              disabled={isOrderPrepared }
              className="bg-transparent text-white outline-none w-full text-sm md:text-base disabled:cursor-not-allowed disabled:opacity-60"
            >
              {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={String(n)} className="bg-black">
                    {n} {n === 1 ? t("ticketSingular") : t("ticketPlural")}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {paymentMethod === "card" && (
          <div className="flex flex-col gap-2">
            <span className="text-white font-inter font-medium text-sm md:text-base">
              {t("installments")}
            </span>
            <div className="grid grid-cols-2 gap-3">
              {cardInstallmentOptions.map((count) => {
                const perInstallment =
                  totalAmountCents > 0 && count > 1
                    ? Math.ceil(totalAmountCents / count)
                    : totalAmountCents;
                return (
                  <button
                    key={count}
                    type="button"
                    disabled={isOrderPrepared }
                    className={`border rounded-2xl px-4 py-3 font-inter text-sm transition-all min-h-[56px] cursor-pointer ${
                      effectiveInstallment === count
                        ? "border-brand text-brand"
                        : "border-white/20 text-white/70 hover:border-brand/60"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {count === 1
                      ? `À vista${totalAmountCents > 0 ? " " + formatCurrency(totalAmountCents, quote?.product.currency) : ""}`
                      : `${count}x de${totalAmountCents > 0 ? " " + formatCurrency(perInstallment, quote?.product.currency) : ""}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {paymentMethod === "klarna" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <p className="font-inter text-sm font-semibold text-white">
                {t("klarnaTitle")}
              </p>
              <p className="mt-1 font-inter text-xs leading-relaxed text-white/60">
                {t("klarnaDescription")}
              </p>
            </div>
          </div>
        )}

        {paymentMethod === "afterpay_clearpay" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <p className="font-inter text-sm font-semibold text-white">
                {t("afterpayTitle")}
              </p>
              <p className="mt-1 font-inter text-xs leading-relaxed text-white/60">
                {t("afterpayDescription")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label
                  htmlFor="afterpay-country"
                  className="text-white font-inter font-medium text-sm md:text-base"
                >
                  {t("afterpayCountry")}
                </label>
                <div className="border border-white/10 rounded-2xl bg-[#1e1e1e] px-6 py-4 min-h-[56px]">
                  <select
                    id="afterpay-country"
                    value={afterpayBillingAddress.country}
                    onChange={(e) =>
                      updateAfterpayBillingAddress("country", e.target.value)
                    }
                    disabled={isOrderPrepared}
                    className="bg-transparent text-white outline-none w-full text-sm md:text-base disabled:cursor-not-allowed"
                  >
                    <option value="US" className="bg-[#1e1e1e]">
                      United States
                    </option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <InputField
                  id="afterpay-line1"
                  label={t("afterpayLine1")}
                  placeholder={t("afterpayLine1Placeholder")}
                  value={afterpayBillingAddress.line1}
                  onChange={(value) => updateAfterpayBillingAddress("line1", value)}
                  autoComplete="billing address-line1"
                  disabled={isOrderPrepared}
                />
              </div>

              <div className="sm:col-span-2">
                <InputField
                  id="afterpay-line2"
                  label={t("afterpayLine2")}
                  placeholder={t("afterpayLine2Placeholder")}
                  value={afterpayBillingAddress.line2}
                  onChange={(value) => updateAfterpayBillingAddress("line2", value)}
                  autoComplete="billing address-line2"
                  disabled={isOrderPrepared}
                  valid={false}
                />
              </div>

              <InputField
                id="afterpay-city"
                label={t("afterpayCity")}
                placeholder={t("afterpayCityPlaceholder")}
                value={afterpayBillingAddress.city}
                onChange={(value) => updateAfterpayBillingAddress("city", value)}
                autoComplete="billing address-level2"
                disabled={isOrderPrepared}
              />

              <InputField
                id="afterpay-state"
                label={t("afterpayState")}
                placeholder={t("afterpayStatePlaceholder")}
                value={afterpayBillingAddress.state}
                onChange={(value) => updateAfterpayBillingAddress("state", value)}
                autoComplete="billing address-level1"
                disabled={isOrderPrepared}
              />

              <InputField
                id="afterpay-postal-code"
                label={t("afterpayPostalCode")}
                placeholder={t("afterpayPostalCodePlaceholder")}
                value={afterpayBillingAddress.postalCode}
                onChange={(value) =>
                  updateAfterpayBillingAddress("postalCode", value)
                }
                autoComplete="billing postal-code"
                disabled={isOrderPrepared}
              />
            </div>
          </div>
        )}

        {(paymentMethod === "card" ||
          paymentMethod === "klarna" ||
          paymentMethod === "afterpay_clearpay") && (
          <div className="flex flex-col gap-4">
            {paymentMethod === "card" && (
              <InputField
                id="cardholder-name"
                label={t("cardName")}
                placeholder={t("cardNamePlaceholder")}
                value={cardholderName}
                onChange={setCardholderName}
                autoComplete="cc-name"
              />
            )}
            <div className="flex flex-col gap-2">
              <span className="text-white font-inter font-medium text-sm md:text-base">
                {paymentMethod === "klarna"
                  ? t("klarnaDetails")
                  : paymentMethod === "afterpay_clearpay"
                    ? t("afterpayDetails")
                    : t("cardDetails")}
              </span>
              <div className="border border-white/20 rounded-2xl p-4 min-h-[220px] bg-black">
                <div ref={paymentElementRef} />
                {!quote && (
                  <p className="text-sm text-white/50 font-inter">
                    {catalogLoading ? t("loadingPaymentFields") : t("paymentFieldsUnavailable")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {requiresCpfCnpj && (
          <MaskedInputField
            id="cpf-cnpj"
            label={t("cpfCnpj")}
            placeholder={t("cpfCnpjPlaceholder")}
            mask="cpf-cnpj"
            value={cpfCnpj}
            onAccept={(v) => setCpfCnpj(v)}
            disabled={isOrderPrepared }
          />
        )}

        {/* Terms */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            disabled={isOrderPrepared }
            className="w-5 h-5 accent-brand flex-shrink-0 disabled:cursor-not-allowed"
            id="terms"
          />
          <span className="text-white/80 text-sm font-inter">
            {t("termsPrefix")}
            <button type="button" className="cursor-pointer text-brand underline underline-offset-2">
              {t("termsLink")}
            </button>
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-300 font-inter" role="alert">
            {error}
          </p>
        )}

        {/* Pricing summary */}
        {quote && (
          <div className="border-t border-white/10 pt-4 flex flex-col gap-1">
            {quote.pricing.discountAmountCents > 0 && (
              <>
                <div className="flex justify-between text-white/60 text-sm font-inter">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.pricing.subtotalAmountCents, quote.product.currency)}</span>
                </div>
                <div className="flex justify-between text-green-400 text-sm font-inter">
                  <span>Desconto</span>
                  <span>−{formatCurrency(quote.pricing.discountAmountCents, quote.product.currency)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-white font-inter font-semibold">
              <span>Total</span>
              <span>{formatCurrency(quote.pricing.totalAmountCents, quote.product.currency)}</span>
            </div>
            {paymentMethod === "card" &&
              effectiveInstallment > 1 &&
              totalAmountCents > 0 && (
              <div className="flex justify-between text-white/60 text-xs font-inter">
                <span>{effectiveInstallment}x de</span>
                <span>
                  {formatCurrency(Math.ceil(quote.pricing.totalAmountCents / effectiveInstallment), quote.product.currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-4">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {t("back")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              paymentMethod === "pix"
                ? !canCreatePixPayment
                : paymentMethod === "klarna"
                  ? !canConfirmKlarnaPayment
                  : paymentMethod === "afterpay_clearpay"
                    ? !canConfirmAfterpayPayment
                  : !canConfirmPayment || isConfirmingPayment
            }
          >
            {paymentMethod === "pix"
              ? isCreatingPix
                ? t("pixGenerating")
                : t("pixSubmit")
              : paymentMethod === "klarna"
                ? isConfirmingPayment
                  ? t("confirming")
                  : t("klarnaSubmit")
                : paymentMethod === "afterpay_clearpay"
                  ? isConfirmingPayment
                    ? t("confirming")
                    : t("afterpaySubmit")
              : isConfirmingPayment
                ? t("confirming")
                : t("submit")}
          </Button>
        </div>
      </form>
      </>
      )}
    </CheckoutLayout>
  );
}
