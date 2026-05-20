import {
  resolveCatalogProduct,
  validateCoupon,
  calculateCatalogOrderAmount,
  type CatalogPricingResult,
} from "@/lib/catalog/resolve";
import { applyInstallmentInterest } from "@/lib/catalog/installments";
import { getUsdBrlRate } from "@/lib/fx/exchange-rate";
import type { CatalogSelection } from "@/lib/catalog/types";

interface QuoteRequestBody {
  turmaId?: string;
  turmaSlug?: string;
  productId?: string;
  productSlug?: string;
  quantity?: number;
  installmentCount?: number;
  couponCode?: string;
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function buildInstallmentLabel(params: {
  installments: number;
  chargedAmountCents: number;
  totalCents: number;
  perInstallmentCents: number;
  interestRatePct: number | null;
}): string {
  const base = `${params.installments}x de ${formatBrl(
    params.perInstallmentCents
  )}`;

  if (params.installments === 1) return base;

  if (params.interestRatePct !== null && params.totalCents !== params.chargedAmountCents) {
    return `${base} (total ${formatBrl(params.totalCents)})`;
  }

  return `${base} (sem juros)`;
}

export async function POST(request: Request) {
  let body: QuoteRequestBody;

  try {
    body = (await request.json()) as QuoteRequestBody;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const selection: CatalogSelection = {
    turmaId: body.turmaId,
    turmaSlug: body.turmaSlug,
    productId: body.productId,
    productSlug: body.productSlug,
  };

  if (!selection.turmaId && !selection.turmaSlug) {
    return Response.json({ error: "Turma não informada." }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await resolveCatalogProduct(selection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Produto não disponível.";
    return Response.json({ error: message }, { status: 404 });
  }

  const quantity = Number(body.quantity) || 1;
  const installmentCount = Number(body.installmentCount) || 1;
  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : null;

  let pricing: CatalogPricingResult;
  try {
    const subtotalCents = resolved.product.unitAmountCents * quantity;
    const coupon =
      couponCode && couponCode.length > 0
        ? await validateCoupon({
            couponCode,
            turmaId: resolved.turma.id,
            productId: resolved.product.id,
            subtotalCents,
          })
        : null;

    pricing = calculateCatalogOrderAmount({
      product: resolved.product,
      quantity,
      installmentCount,
      coupon,
    });

    const exchangeRate =
      pricing.currency === "usd" ? await getUsdBrlRate() : null;
    const chargedAmountCents = exchangeRate
      ? Math.ceil(pricing.totalAmountCents * exchangeRate)
      : pricing.totalAmountCents;
    const chargedCurrency = "brl" as const;
    const installmentBreakdown = resolved.product.installmentOptions.map(
      (installments) => {
        const interestRatePct =
          resolved.product.installmentRates[String(installments)] ?? null;
        const result = applyInstallmentInterest(
          chargedAmountCents,
          installments,
          interestRatePct
        );

        return {
          installments,
          totalCents: result.totalCents,
          perInstallmentCents: result.perInstallmentCents,
          interestRatePct: result.interestRatePct,
          label: buildInstallmentLabel({
            installments,
            chargedAmountCents,
            totalCents: result.totalCents,
            perInstallmentCents: result.perInstallmentCents,
            interestRatePct: result.interestRatePct,
          }),
        };
      }
    );

    return Response.json({
      turma: { id: resolved.turma.id, name: resolved.turma.name, slug: resolved.turma.slug },
      product: {
        id: resolved.product.id,
        name: resolved.product.name,
        slug: resolved.product.slug,
        description: resolved.product.description,
        unitAmountCents: resolved.product.unitAmountCents,
        currency: resolved.product.currency,
        maxQuantity: resolved.product.maxQuantity,
        installmentOptions: resolved.product.installmentOptions,
      },
      pricing: {
        ...pricing,
        chargedAmountCents,
        chargedCurrency,
        exchangeRate,
        installmentBreakdown,
      },
      coupon: couponCode
        ? coupon
          ? { applied: true, code: coupon.code, discountAmountCents: coupon.discountAmountCents }
          : { applied: false, reason: "Cupom inválido ou fora do escopo." }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao calcular cotação.";
    const status = message.includes("cotação do dólar") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
