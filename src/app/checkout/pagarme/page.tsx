"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Button,
  CheckoutLayout,
  InputField,
  MaskedInputField,
  StepIndicator,
} from "@/components/checkout";
import {
  loadCatalogSelection,
  loadTracking,
  resolveStoredSellerIdentifier,
} from "@/lib/tracking";
import { formatSaoPauloDate } from "@/lib/timezone";
import {
  ensureCheckoutLeadId,
  getStoredCheckoutLeadId,
} from "@/lib/checkout/lead-session";

type ProductPaymentMethod = "card" | "pix";
type PagarmeCheckoutMethod = "credit_card" | "pix";

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
  paymentMethods: ProductPaymentMethod[];
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

interface InstallmentBreakdown {
  installments: number;
  totalCents: number;
  perInstallmentCents: number;
  interestRatePct: number | null;
  label: string;
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
  pricing: {
    quantity: number;
    installmentCount: number;
    unitAmountCents: number;
    subtotalAmountCents: number;
    discountAmountCents: number;
    totalAmountCents: number;
    installmentBreakdown: InstallmentBreakdown[];
  };
  coupon:
    | { applied: true; code: string; discountAmountCents: number }
    | { applied: false; reason: string }
    | null;
}

interface PixPaymentState {
  orderId: string;
  qrCode: string;
  qrCodeUrl: string | null;
  expiresAt: string;
}

const PAGARME_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY ?? "";
const PAGARME_TOKEN_BASE_URL = PAGARME_PUBLIC_KEY.startsWith("pk_test_")
  ? "https://sdx-api.pagar.me/core/v5"
  : "https://api.pagar.me/core/v5";

const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds: "Saldo insuficiente. Tente outro cartão.",
  expired_card: "Cartão vencido. Verifique a data de validade.",
  invalid_cvv: "CVV inválido.",
  do_not_honor: "Transação não autorizada pelo banco.",
  card_declined: "Cartão recusado. Verifique os dados.",
  generic_decline: "Transação não aprovada. Tente outro cartão ou método.",
};

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


function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function getAvailablePagarmeMethods(
  product?: ProductOption | null
): PagarmeCheckoutMethod[] {
  const productMethods = product?.paymentMethods ?? ["card"];
  const methods: PagarmeCheckoutMethod[] = [];

  if (productMethods.includes("card")) methods.push("credit_card");
  if (productMethods.includes("pix")) methods.push("pix");

  return methods;
}

function extractPagarmeToken(data: Record<string, unknown>): string | null {
  const direct = data.id ?? data.token ?? data.card_token ?? data.pagarmetoken;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("pagarmetoken") && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getPagarmeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }

  return "Não foi possível tokenizar o cartão. Confira os dados.";
}

function PixIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/pix-brand.svg"
      alt=""
      width={96}
      height={96}
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
      width={96}
      height={96}
      className={`object-contain ${className}`}
      aria-hidden="true"
    />
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

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-13.66 5.66M4 12A8 8 0 0 1 17.66 6.34"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M7 18H4v-3M17 6h3v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckoutFormSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4">
      <div className="h-16 rounded-full bg-[#f3f5fa]" />
      <div className="h-16 rounded-2xl bg-[#f3f5fa]" />
      <div className="h-16 rounded-2xl bg-[#f3f5fa]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 rounded-2xl bg-[#f3f5fa]" />
        <div className="h-14 rounded-2xl bg-[#f3f5fa]" />
      </div>
      <div className="h-14 rounded-full bg-[#f3f5fa]" />
    </div>
  );
}

function PagarmeTextInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  element,
  inputMode = "text",
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  element: string;
  inputMode?: "text" | "numeric";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-inter text-sm font-medium text-[#2b3674] md:text-base">
        {label}
      </label>
      <div className="flex min-h-[56px] items-center rounded-2xl border border-[#e0e5f2] bg-white px-6 py-4">
        <input
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          data-pagarmecheckout-element={element}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          className="min-h-[24px] w-full bg-transparent font-inter text-sm text-[#2b3674] outline-none placeholder:text-[#a3aed0] md:text-base"
        />
      </div>
    </div>
  );
}

export default function PagarmeCheckoutPage() {
  const t = useTranslations("cartao");
  const router = useRouter();

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
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] =
    useState<PagarmeCheckoutMethod>("credit_card");
  const [quantity, setQuantity] = useState(1);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [activeCouponCode, setActiveCouponCode] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isCreatingPix, setIsCreatingPix] = useState(false);
  const [pixPayment, setPixPayment] = useState<PixPaymentState | null>(null);
  const [copiedPixCode, setCopiedPixCode] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState("");

  const selectedTurma = turmaOptions.find((o) => o.id === selectedTurmaId);
  const selectedProduct = selectedTurma?.products.find(
    (p) => p.id === selectedProductId
  );
  const availableMethods = getAvailablePagarmeMethods(selectedProduct);
  const availableMethodKey = availableMethods.join(",");
  const maxQuantity = Math.min(
    quote?.product.maxQuantity ?? selectedProduct?.maxQuantity ?? 5,
    10
  );
  const isIdentityValid = normalizeDigits(cpfCnpj).length >= 11;
  const hasCatalogSelection = Boolean(selectedTurmaId && selectedProductId);
  const canCreateBaseOrder =
    termsAccepted && isIdentityValid && hasCatalogSelection && !catalogLoading;
  const cardDigits = normalizeDigits(cardNumber);
  const isCardFormReady =
    cardholderName.trim().length >= 3 &&
    cardDigits.length >= 13 &&
    Number(cardExpMonth) >= 1 &&
    Number(cardExpMonth) <= 12 &&
    cardExpYear.trim().length >= 2 &&
    normalizeDigits(cardCvv).length >= 3;
  const canConfirmCard =
    selectedMethod === "credit_card" &&
    canCreateBaseOrder &&
    isCardFormReady &&
    Boolean(PAGARME_PUBLIC_KEY) &&
    !isConfirmingPayment;
  const canCreatePix =
    selectedMethod === "pix" &&
    canCreateBaseOrder &&
    !isCreatingPix &&
    Boolean(quote);
  const pixExpiresAtMs = pixPayment
    ? new Date(pixPayment.expiresAt).getTime()
    : 0;
  const pixSecondsRemaining = pixPayment
    ? Math.max(0, Math.floor((pixExpiresAtMs - nowSeconds * 1000) / 1000))
    : 0;
  const isPixExpired = Boolean(pixPayment && pixSecondsRemaining <= 0);
  const selectedInstallment = quote?.pricing.installmentBreakdown.find(
    (item) => item.installments === installmentCount
  );

  async function initCatalog(
    turmaId: string | null,
    turmaSlug: string | null,
    productId: string | null,
    productSlug: string | null
  ) {
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/catalog/options", { cache: "no-store" });
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
      setError("Não foi possível carregar o catálogo agora.");
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
      const data = (await res.json().catch(() => null)) as
        | (QuoteResult & { error?: string })
        | null;

      if (!res.ok || !data) {
        setError(data?.error ?? "Não foi possível calcular o preço agora.");
        return null;
      }

      setQuote(data);
      const counts = data.pricing.installmentBreakdown.map((item) => item.installments);
      if (!counts.includes(inst)) {
        setInstallmentCount(counts[0] ?? 1);
      }
      return data;
    } catch {
      setError("Não foi possível calcular o preço agora.");
      return null;
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
    setInstallmentCount(1);
    setCoupon("");
    setActiveCouponCode("");
    setQuote(null);
    setPixPayment(null);
    if (pid) await doFetchQuote(tid, pid, 1, 1, "");
  }

  async function handleProductChange(pid: string) {
    if (!selectedTurmaId) return;
    setSelectedProductId(pid);
    setQuantity(1);
    setInstallmentCount(1);
    setCoupon("");
    setActiveCouponCode("");
    setQuote(null);
    setPixPayment(null);
    await doFetchQuote(selectedTurmaId, pid, 1, 1, "");
  }

  async function handleQuantityChange(newQty: number) {
    setQuantity(newQty);
    setPixPayment(null);
    if (selectedTurmaId && selectedProductId) {
      await doFetchQuote(
        selectedTurmaId,
        selectedProductId,
        newQty,
        installmentCount,
        activeCouponCode
      );
    }
  }

  async function handleInstallmentChange(count: number) {
    setInstallmentCount(count);
    if (selectedTurmaId && selectedProductId) {
      await doFetchQuote(
        selectedTurmaId,
        selectedProductId,
        quantity,
        count,
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
      installmentCount,
      coupon
    );
    if (result?.coupon?.applied) {
      setActiveCouponCode(coupon);
      setPixPayment(null);
    } else {
      setActiveCouponCode("");
    }
  }

  function handleMethodChange(method: PagarmeCheckoutMethod) {
    if (isConfirmingPayment || isCreatingPix) return;
    setSelectedMethod(method);
    setError("");
    if (method === "credit_card") setPixPayment(null);
  }

  function buildBaseCheckoutPayload(leadId: string) {
    return {
      leadId,
      quantity,
      installmentCount,
      couponCode: activeCouponCode || undefined,
      cpfCnpj,
      turmaId: selectedTurmaId,
      productId: selectedProductId,
      sellerId: sellerIdentifier.sellerId || undefined,
      sellerSlug: sellerIdentifier.sellerSlug || undefined,
    };
  }

  async function submitCardToken(cardToken: string) {
    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace("/formulario");
      return;
    }

    try {
      const response = await fetch("/api/checkout/pagarme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBaseCheckoutPayload(leadId),
          paymentMethod: "credit_card",
          cardToken,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            status?: string;
            error?: string;
            declineReason?: string;
          }
        | null;

      if (!response.ok) {
        const friendlyDecline = data?.declineReason
          ? DECLINE_MESSAGES[data.declineReason]
          : null;
        setError(friendlyDecline ?? data?.error ?? t("paymentError"));
        return;
      }

      if (!data?.orderId) {
        setError(t("paymentError"));
        return;
      }

      sessionStorage.setItem("pib_order_id", data.orderId);
      router.push(`${"/obrigado"}?orderId=${data.orderId}`);
    } catch {
      setError(t("paymentError"));
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  async function tokenizeCard(): Promise<string | null> {
    if (!PAGARME_PUBLIC_KEY) {
      setError("Chave pública do pagar.me não configurada.");
      return null;
    }

    try {
      const response = await fetch(
        `${PAGARME_TOKEN_BASE_URL}/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "card",
            card: {
              number: cardDigits,
              holder_name: cardholderName.trim(),
              exp_month: Number(cardExpMonth),
              exp_year: Number(cardExpYear),
              cvv: normalizeDigits(cardCvv),
            },
          }),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | (Record<string, unknown> & { message?: string })
        | null;

      if (!response.ok || !data) {
        setError(getPagarmeErrorMessage(data));
        return null;
      }

      const token = extractPagarmeToken(data);
      if (!token) {
        setError("Não foi possível gerar o token do cartão.");
        return null;
      }

      return token;
    } catch {
      setError("Não foi possível gerar o token do cartão.");
      return null;
    }
  }

  async function handleCardSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfirmCard) return;

    setError("");
    setIsConfirmingPayment(true);

    const token = await tokenizeCard();
    if (!token) {
      setIsConfirmingPayment(false);
      return;
    }

    await submitCardToken(token);
  }

  async function handleCreatePixPayment(options?: { replaceExisting?: boolean }) {
    if (!canCreatePix || (pixPayment && !options?.replaceExisting)) return;

    const leadId = await ensureCheckoutLeadId();
    if (!leadId) {
      router.replace("/formulario");
      return;
    }

    setError("");
    setIsCreatingPix(true);
    setCopiedPixCode(false);

    try {
      const response = await fetch("/api/checkout/pagarme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBaseCheckoutPayload(leadId),
          installmentCount: 1,
          paymentMethod: "pix",
          pixExpiresIn: 60 * 60,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            orderId?: string;
            status?: string;
            pix?: {
              qrCode?: string;
              qrCodeUrl?: string | null;
              expiresAt?: string | null;
            };
            error?: string;
          }
        | null;

      if (!response.ok || !data?.orderId || !data.pix?.qrCode || !data.pix.expiresAt) {
        setError(data?.error ?? t("pixError"));
        return;
      }

      sessionStorage.setItem("pib_order_id", data.orderId);
      setPixPayment({
        orderId: data.orderId,
        qrCode: data.pix.qrCode,
        qrCodeUrl: data.pix.qrCodeUrl ?? null,
        expiresAt: data.pix.expiresAt,
      });
      setNowSeconds(Math.floor(Date.now() / 1000));
    } catch {
      setError(t("pixError"));
    } finally {
      setIsCreatingPix(false);
    }
  }

  async function handleCopyPixCode() {
    if (!pixPayment?.qrCode) return;

    try {
      await navigator.clipboard.writeText(pixPayment.qrCode);
      setCopiedPixCode(true);
      window.setTimeout(() => setCopiedPixCode(false), 2000);
    } catch {
      setError(t("copyError"));
    }
  }

  async function handleRegeneratePix() {
    setPixPayment(null);
    await handleCreatePixPayment({ replaceExisting: true });
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      void (async () => {
        const leadId = await ensureCheckoutLeadId();
        if (!leadId) {
          router.replace("/formulario");
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
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const methods = availableMethodKey
      ? (availableMethodKey.split(",") as PagarmeCheckoutMethod[])
      : [];
    if (methods.length === 0 || methods.includes(selectedMethod)) return;

    window.queueMicrotask(() => {
      setSelectedMethod(methods[0]);
      setPixPayment(null);
      setError("");
    });
  }, [availableMethodKey, selectedMethod]);

  useEffect(() => {
    const currentPixPayment = pixPayment;
    if (!currentPixPayment || isPixExpired) return;
    const pixOrderId = currentPixPayment.orderId;

    const leadId = getStoredCheckoutLeadId();
    if (!leadId) return;

    let cancelled = false;

    async function pollStatus() {
      try {
        const response = await fetch(
          `/api/orders/${pixOrderId}/status?leadId=${leadId}`,
          { cache: "no-store" }
        );
        const data = (await response.json().catch(() => null)) as
          | {
              status?: string;
              pagarmeFailureMessage?: string | null;
            }
          | null;
        if (cancelled || !response.ok) return;

        if (data?.status === "paid") {
          sessionStorage.setItem("pib_order_id", pixOrderId);
          router.push(`${"/obrigado"}?orderId=${pixOrderId}`);
        } else if (data?.status === "expired") {
          setPixPayment((current) =>
            current?.orderId === pixOrderId
              ? { ...current, expiresAt: new Date().toISOString() }
              : current
          );
        } else if (data?.status === "payment_failed") {
          setError(data.pagarmeFailureMessage ?? t("paymentError"));
        }
      } catch {
        // polling retries on the next interval
      }
    }

    void pollStatus();
    const interval = window.setInterval(pollStatus, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isPixExpired, pixPayment, router, t]);

  const badgeLabel =
    quote?.turma.name ??
    (turmaOptions.length === 1 ? turmaOptions[0].name : null) ??
    null;
  const totalAmountCents = quote?.pricing.totalAmountCents ?? 0;

  return (
    <CheckoutLayout>
      <StepIndicator currentStep={2} />

      {catalogLoading ? (
        <CheckoutFormSkeleton />
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <div className="mb-6">
            <h2 className="text-[#2b3674] font-sora font-bold text-lg text-center mb-4">
              Selecione a sua turma
            </h2>
            {turmaOptions.length === 0 ? (
              <div className="rounded-2xl border border-[#e0e5f2] bg-[#f8faff] px-6 py-5 text-center">
                <p className="font-inter text-sm font-semibold text-[#2b3674] md:text-base">
                  Nenhuma turma com ingresso disponível no momento.
                </p>
              </div>
            ) : turmaOptions.length > 1 ? (
              <div className="min-h-[56px] rounded-2xl border border-[#0077ff]/40 bg-white px-6 py-4">
                <select
                  value={selectedTurmaId ?? ""}
                  onChange={(event) => handleTurmaChange(event.target.value)}
                  className="w-full bg-transparent font-inter text-sm text-[#2b3674] outline-none md:text-base"
                >
                  {turmaOptions.map((turma) => (
                    <option key={turma.id} value={turma.id} className="bg-white">
                      {turma.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="border border-[#0077ff]/40 rounded-full w-full px-8 py-5 text-center">
                {badgeLabel && (
                  <p className="text-[#2b3674] font-sora font-bold text-sm md:text-base">
                    {badgeLabel}
                  </p>
                )}
                {selectedTurma?.startsAt && (
                  <p className="text-[#a3aed0] font-inter text-sm mt-0.5">
                    {formatTurmaDateRange(selectedTurma.startsAt, selectedTurma.endsAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {selectedTurma && selectedTurma.products.length > 1 && (
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm font-medium text-[#2b3674] md:text-base">
                Selecione o ingresso
              </label>
              <div className="min-h-[56px] rounded-2xl border border-[#e0e5f2] bg-white px-6 py-4">
                <select
                  value={selectedProductId ?? ""}
                  onChange={(event) => handleProductChange(event.target.value)}
                  className="w-full bg-transparent font-inter text-sm text-[#2b3674] outline-none md:text-base"
                >
                  {selectedTurma.products.map((product) => (
                    <option key={product.id} value={product.id} className="bg-white">
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {availableMethods.length > 1 && (
            <div className="flex flex-col items-center gap-4">
              <p className="font-inter text-sm font-medium text-[#2b3674] md:text-base">
                {t("paymentMethod")}
              </p>
              <div className="grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleMethodChange("credit_card")}
                  className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-5 font-inter text-sm font-semibold transition-all ${
                    selectedMethod === "credit_card"
                      ? "border-[#0077ff] text-[#2b3674] shadow-[0_0_0_1px_rgba(0,119,255,0.55)]"
                      : "border-[#e0e5f2] bg-white text-[#a3aed0] hover:border-[#0077ff]/60"
                  }`}
                  aria-pressed={selectedMethod === "credit_card"}
                >
                  <CardIcon className="h-5 w-5 text-brand" />
                  {t("tabCard")}
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodChange("pix")}
                  className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-3 rounded-full border px-5 font-inter text-sm font-semibold transition-all ${
                    selectedMethod === "pix"
                      ? "border-[#0077ff] text-[#2b3674] shadow-[0_0_0_1px_rgba(0,119,255,0.55)]"
                      : "border-[#e0e5f2] bg-white text-[#a3aed0] hover:border-[#0077ff]/60"
                  }`}
                  aria-pressed={selectedMethod === "pix"}
                >
                  <PixIcon className="h-5 w-5 text-brand" />
                  {t("tabPix")}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-end">
            <div className="min-w-0">
              <InputField
                id="coupon"
                label={t("coupon")}
                placeholder={t("couponPlaceholder")}
                value={coupon}
                onChange={setCoupon}
              />
            </div>
            <div className="md:pb-[1px]">
              <Button
                type="button"
                variant="primary"
                onClick={handleApplyCoupon}
                fullWidth
                disabled={!coupon.trim() || !selectedTurmaId || !selectedProductId}
              >
                {t("couponApply")}
              </Button>
            </div>
          </div>

          {quote?.coupon && (
            <p
              className={`-mt-3 font-inter text-sm ${
                quote.coupon.applied ? "text-green-600" : "text-red-600"
              }`}
            >
              {quote.coupon.applied
                ? `Cupom aplicado: -${formatCurrency(quote.coupon.discountAmountCents, quote.product.currency)}`
                : "Cupom inválido ou fora do escopo."}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="quantity" className="font-inter text-sm font-medium text-[#2b3674] md:text-base">
              {t("quantity")}
            </label>
            <div className="min-h-[56px] rounded-2xl border border-[#e0e5f2] bg-white px-6 py-4">
              <select
                id="quantity"
                value={String(quantity)}
                onChange={(event) => handleQuantityChange(Number(event.target.value))}
                className="w-full bg-transparent font-inter text-sm text-[#2b3674] outline-none md:text-base"
              >
                {Array.from({ length: Math.max(1, maxQuantity) }, (_, index) => index + 1).map((n) => (
                  <option key={n} value={String(n)} className="bg-white">
                    {n} {n === 1 ? t("ticketSingular") : t("ticketPlural")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedMethod === "credit_card" && (
            <form
              onSubmit={handleCardSubmit}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <span className="font-inter text-sm font-medium text-[#2b3674] md:text-base">
                  {t("installments")}
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(quote?.pricing.installmentBreakdown ?? []).map((item) => (
                    <button
                      key={item.installments}
                      type="button"
                      onClick={() => handleInstallmentChange(item.installments)}
                      className={`min-h-[64px] cursor-pointer rounded-2xl border px-4 py-3 text-left font-inter text-sm transition-all ${
                        installmentCount === item.installments
                          ? "border-[#0077ff] text-brand"
                          : "border-[#e0e5f2] text-[#a3aed0] hover:border-[#0077ff]/60"
                      }`}
                    >
                      {`${item.installments}x ${formatCurrency(item.perInstallmentCents, "brl")}`}
                    </button>
                  ))}
                </div>
              </div>

              <PagarmeTextInput
                id="card-holder-name"
                label={t("cardName")}
                value={cardholderName}
                onChange={setCardholderName}
                autoComplete="cc-name"
                element="holder_name"
                placeholder={t("cardNamePlaceholder")}
              />

              <PagarmeTextInput
                id="card-number"
                label={t("cardNumber")}
                value={cardNumber}
                onChange={setCardNumber}
                autoComplete="cc-number"
                element="number"
                inputMode="numeric"
                maxLength={23}
                placeholder={t("cardNumberPlaceholder")}
              />

              <div className="grid grid-cols-3 gap-3">
                <PagarmeTextInput
                  id="card-exp-month"
                  label="Mês"
                  value={cardExpMonth}
                  onChange={(value) => setCardExpMonth(normalizeDigits(value).slice(0, 2))}
                  autoComplete="cc-exp-month"
                  element="exp_month"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                />
                <PagarmeTextInput
                  id="card-exp-year"
                  label="Ano"
                  value={cardExpYear}
                  onChange={(value) => setCardExpYear(normalizeDigits(value).slice(0, 4))}
                  autoComplete="cc-exp-year"
                  element="exp_year"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="AA"
                />
                <PagarmeTextInput
                  id="card-cvv"
                  label={t("cvv")}
                  value={cardCvv}
                  onChange={(value) => setCardCvv(normalizeDigits(value).slice(0, 4))}
                  autoComplete="cc-csc"
                  element="cvv"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t("cvvPlaceholder")}
                />
              </div>

              {!PAGARME_PUBLIC_KEY && (
                <p className="font-inter text-sm text-red-600" role="alert">
                  Chave pública do pagar.me não configurada.
                </p>
              )}

              <MaskedInputField
                id="cpf-cnpj"
                label={t("cpfCnpj")}
                placeholder={t("cpfCnpjPlaceholder")}
                mask="cpf-cnpj"
                value={cpfCnpj}
                onAccept={(value) => setCpfCnpj(value)}
              />

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="h-5 w-5 flex-shrink-0 accent-brand"
                  id="terms-card"
                />
                <span className="font-inter text-sm text-[#2b3674]/80">
                  {t("termsPrefix")}
                  <button type="button" className="cursor-pointer text-brand underline underline-offset-2">
                    {t("termsLink")}
                  </button>
                </span>
              </label>

              {selectedInstallment && (
                <div className="border-t border-[#e0e5f2] pt-4">
                  <div className="flex justify-between font-inter font-semibold text-[#2b3674]">
                    <span>Total</span>
                    <span>
                      {formatCurrency(selectedInstallment.totalCents, "brl")}
                    </span>
                  </div>
                  {selectedInstallment.installments > 1 && (
                    <div className="mt-1 flex justify-between font-inter text-xs text-[#a3aed0]">
                      <span>{selectedInstallment.installments}x</span>
                      <span>
                        {formatCurrency(selectedInstallment.perInstallmentCents, "brl")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="font-inter text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  {t("back")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canConfirmCard}
                >
                  {isConfirmingPayment ? t("confirming") : t("submit")}
                </Button>
              </div>
            </form>
          )}

          {selectedMethod === "pix" && (
            <div className="flex flex-col gap-5">
              <MaskedInputField
                id="cpf-cnpj-pix"
                label={t("cpfCnpj")}
                placeholder={t("cpfCnpjPlaceholder")}
                mask="cpf-cnpj"
                value={cpfCnpj}
                onAccept={(value) => setCpfCnpj(value)}
              />

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="h-5 w-5 flex-shrink-0 accent-brand"
                  id="terms-pix"
                />
                <span className="font-inter text-sm text-[#2b3674]/80">
                  {t("termsPrefix")}
                  <button type="button" className="cursor-pointer text-brand underline underline-offset-2">
                    {t("termsLink")}
                  </button>
                </span>
              </label>

              {pixPayment ? (
                <div className="flex flex-col items-center gap-5 rounded-2xl border border-[#e0e5f2] bg-[#f3f5fa] p-5 text-center">
                  {isPixExpired ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={isCreatingPix}
                      onClick={handleRegeneratePix}
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshIcon className="h-5 w-5" />
                        {isCreatingPix ? t("pixGenerating") : t("pixTryAgain")}
                      </span>
                    </Button>
                  ) : pixPayment.qrCodeUrl ? (
                    // Pagar.me returns a short-lived external QR image URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pixPayment.qrCodeUrl}
                      alt={t("pixQrAlt")}
                      className="h-56 w-56 bg-white p-3"
                    />
                  ) : (
                    <div className="rounded-2xl border border-[#e0e5f2] bg-[#f3f5fa] p-4 font-inter text-sm text-[#a3aed0]">
                      QR Code indisponível. Use o copia e cola abaixo.
                    </div>
                  )}

                  {!isPixExpired && (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyPixCode}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 bg-white px-5 py-4 text-left font-inter text-black transition-opacity hover:opacity-90"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold md:text-base">
                            {copiedPixCode ? t("pixCopied") : t("pixCopy")}
                          </span>
                          <span className="block truncate text-sm font-semibold text-black/45">
                            {pixPayment.qrCode}
                          </span>
                        </span>
                        <CopyIcon className="h-6 w-6 flex-shrink-0 text-brand" />
                      </button>

                      <div className="font-sora text-2xl font-extrabold text-[#2b3674]">
                        <p>{t("pixTimeLabel")}</p>
                        <p>{formatCountdown(pixSecondsRemaining)}</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="border-t border-[#e0e5f2] pt-4">
                  <div className="flex justify-between font-inter font-semibold text-[#2b3674]">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmountCents, "brl")}</span>
                  </div>
                </div>
              )}

              {error && (
                <p className="font-inter text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  {t("back")}
                </Button>
                {!pixPayment && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canCreatePix}
                    onClick={() => handleCreatePixPayment()}
                  >
                    {isCreatingPix ? t("pixGenerating") : t("pixSubmit")}
                  </Button>
                )}
              </div>
            </div>
          )}

          {availableMethods.length === 0 && (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-center font-inter text-sm text-red-200">
              Este produto não possui cartão ou Pix habilitado no admin.
            </p>
          )}
        </div>
      )}
    </CheckoutLayout>
  );
}
