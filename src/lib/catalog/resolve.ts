import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveSeller } from "./sellers";
import type {
  CatalogSelection,
  ResolvedCatalogProduct,
  AppliedCoupon,
  PublicCheckoutTurmaOption,
  InstallmentCount,
  PaymentMethodType,
} from "./types";

function normalizePaymentMethods(value: unknown): PaymentMethodType[] {
  const methods = Array.isArray(value) ? value : ["card"];
  const normalized = methods.filter(
    (method): method is PaymentMethodType => method === "card" || method === "pix"
  );

  return normalized.length > 0 ? normalized : ["card"];
}

function normalizeInstallmentRates(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        Number.isInteger(Number(entry[0])) &&
        typeof entry[1] === "number" &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0 &&
        entry[1] <= 999.99
    )
  );
}

export async function listPublicCheckoutOptions(): Promise<
  PublicCheckoutTurmaOption[]
> {
  const supabase = getSupabaseAdmin();

  const { data: turmas, error: turmasError } = await supabase
    .from("turmas")
    .select("id, slug, name, starts_at, ends_at, location")
    .eq("status", "active")
    .order("starts_at", { ascending: true });

  if (turmasError) throw new Error("Falha ao buscar turmas públicas.");

  if (!turmas || turmas.length === 0) return [];

  const result: PublicCheckoutTurmaOption[] = [];

  for (const turma of turmas) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(
        "id, slug, name, description, unit_amount_cents, currency, max_quantity, installment_options, is_default, payment_methods, installment_rates"
      )
      .eq("turma_id", turma.id as string)
      .eq("active", true)
      .order("is_default", { ascending: false });

    if (productsError) continue;

    if (!products || products.length === 0) continue;

    result.push({
      id: turma.id as string,
      slug: turma.slug as string,
      name: turma.name as string,
      startsAt: (turma.starts_at as string | null) ?? null,
      endsAt: (turma.ends_at as string | null) ?? null,
      location: (turma.location as string | null) ?? null,
      products: products.map((p) => ({
        id: p.id as string,
        slug: p.slug as string,
        name: p.name as string,
        description: (p.description as string | null) ?? null,
        unitAmountCents: p.unit_amount_cents as number,
        currency: "brl",
        maxQuantity: p.max_quantity as number,
        installmentOptions: p.installment_options as InstallmentCount[],
        isDefault: p.is_default as boolean,
        paymentMethods: normalizePaymentMethods(p.payment_methods),
        installmentRates: normalizeInstallmentRates(p.installment_rates),
      })),
    });
  }

  return result;
}

export async function resolveCatalogProduct(
  selection: CatalogSelection
): Promise<ResolvedCatalogProduct> {
  const supabase = getSupabaseAdmin();

  // Resolve turma
  let turmaId: string | null = selection.turmaId ?? null;

  if (!turmaId && selection.turmaSlug) {
    const { data } = await supabase
      .from("turmas")
      .select("id, name, slug, starts_at, status")
      .eq("slug", selection.turmaSlug)
      .maybeSingle();

    if (!data) {
      throw new Error("Turma não encontrada.");
    }
    turmaId = data.id as string;
  }

  if (!turmaId) {
    throw new Error("Turma não informada.");
  }

  const { data: turmaRow } = await supabase
    .from("turmas")
    .select("id, name, slug, starts_at, status")
    .eq("id", turmaId)
    .maybeSingle();

  if (!turmaRow || turmaRow.status !== "active") {
    throw new Error("Turma não disponível.");
  }

  // Resolve product
  let productQuery = supabase
    .from("products")
    .select(
      "id, name, slug, description, unit_amount_cents, currency, max_quantity, active, installment_options, is_default, payment_methods, installment_rates"
    )
    .eq("turma_id", turmaId)
    .eq("active", true);

  if (selection.productId) {
    productQuery = productQuery.eq("id", selection.productId);
  } else if (selection.productSlug) {
    productQuery = productQuery.eq("slug", selection.productSlug);
  } else {
    // Use default product for turma
    productQuery = productQuery
      .eq("is_default", true)
      .order("created_at", { ascending: true });
  }

  const { data: productRow } = await productQuery.maybeSingle();

  if (!productRow) {
    throw new Error("Produto não disponível.");
  }

  return {
    turma: {
      id: turmaRow.id as string,
      name: turmaRow.name as string,
      slug: turmaRow.slug as string,
      startsAt: (turmaRow.starts_at as string | null) ?? null,
      status: turmaRow.status as ResolvedCatalogProduct["turma"]["status"],
    },
    product: {
      id: productRow.id as string,
      name: productRow.name as string,
      slug: productRow.slug as string,
      description: (productRow.description as string | null) ?? null,
      unitAmountCents: productRow.unit_amount_cents as number,
      currency: "brl",
      maxQuantity: productRow.max_quantity as number,
      active: productRow.active as boolean,
      installmentOptions: productRow.installment_options as InstallmentCount[],
      paymentMethods: normalizePaymentMethods(productRow.payment_methods),
      installmentRates: normalizeInstallmentRates(productRow.installment_rates),
    },
  };
}

export async function validateCoupon(params: {
  couponCode: string;
  turmaId: string;
  productId: string;
  subtotalCents: number;
  now?: Date;
}): Promise<AppliedCoupon | null> {
  const supabase = getSupabaseAdmin();
  const now = params.now ?? new Date();

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", params.couponCode.toUpperCase())
    .eq("active", true)
    .maybeSingle();

  if (!coupon) return null;

  // Check date validity
  if (coupon.starts_at && new Date(coupon.starts_at as string) > now) {
    return null;
  }
  if (coupon.ends_at && new Date(coupon.ends_at as string) < now) {
    return null;
  }

  // Check redemption limit
  if (
    coupon.max_redemptions !== null &&
    (coupon.redeemed_count as number) >= (coupon.max_redemptions as number)
  ) {
    return null;
  }

  // Check minimum subtotal
  if (
    coupon.minimum_subtotal_cents !== null &&
    params.subtotalCents < (coupon.minimum_subtotal_cents as number)
  ) {
    return null;
  }

  // Check turma scope
  const { data: turmaScope } = await supabase
    .from("coupon_turmas")
    .select("turma_id")
    .eq("coupon_id", coupon.id as string);

  if (turmaScope && turmaScope.length > 0) {
    const allowed = turmaScope.some((r) => r.turma_id === params.turmaId);
    if (!allowed) return null;
  }

  // Check product scope
  const { data: productScope } = await supabase
    .from("coupon_products")
    .select("product_id")
    .eq("coupon_id", coupon.id as string);

  if (productScope && productScope.length > 0) {
    const allowed = productScope.some((r) => r.product_id === params.productId);
    if (!allowed) return null;
  }

  // Calculate discount
  let discountAmountCents: number;
  const discountValue = coupon.discount_value as number;

  if (coupon.discount_type === "percent") {
    discountAmountCents = Math.floor(
      (params.subtotalCents * discountValue) / 100
    );
  } else {
    discountAmountCents = discountValue;
  }

  // Apply max_discount_cents cap
  if (coupon.max_discount_cents !== null) {
    discountAmountCents = Math.min(
      discountAmountCents,
      coupon.max_discount_cents as number
    );
  }

  // Clamp to subtotal
  discountAmountCents = Math.min(discountAmountCents, params.subtotalCents);

  return {
    id: coupon.id as string,
    code: coupon.code as string,
    name: coupon.name as string,
    discountType: coupon.discount_type as AppliedCoupon["discountType"],
    discountValue,
    discountAmountCents,
  };
}

export { resolveSeller };

export interface CatalogOrderAmountInput {
  product: ResolvedCatalogProduct["product"];
  quantity: number;
  installmentCount: number;
  coupon?: AppliedCoupon | null;
}

export interface CatalogPricingResult {
  quantity: number;
  installmentCount: InstallmentCount;
  unitAmountCents: number;
  subtotalAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  currency: "brl";
}

export function calculateCatalogOrderAmount(
  input: CatalogOrderAmountInput
): CatalogPricingResult {
  const { product, quantity, installmentCount, coupon } = input;

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.maxQuantity) {
    throw new Error(`Quantidade inválida. Máximo: ${product.maxQuantity}.`);
  }

  const allowedInstallments = product.installmentOptions as number[];
  if (!allowedInstallments.includes(installmentCount)) {
    throw new Error("Parcelamento não disponível para este produto.");
  }

  const unitAmountCents = product.unitAmountCents;
  const subtotalAmountCents = unitAmountCents * quantity;
  const discountAmountCents = coupon?.discountAmountCents ?? 0;
  const totalAmountCents = Math.max(
    subtotalAmountCents - discountAmountCents,
    50
  );

  return {
    quantity,
    installmentCount: installmentCount as InstallmentCount,
    unitAmountCents,
    subtotalAmountCents,
    discountAmountCents,
    totalAmountCents,
    currency: product.currency,
  };
}
