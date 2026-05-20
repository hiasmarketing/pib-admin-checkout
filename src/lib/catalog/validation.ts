import "server-only";

import type { TurmaInput, ProductInput, CouponInput, SellerInput } from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,48}$/;
const ALLOWED_INSTALLMENTS = [1, 2, 3, 6, 12] as const;
const ALLOWED_PAYMENT_METHODS = [
  "card",
  "pix",
  "klarna",
  "afterpay_clearpay",
] as const;

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateTurmaInput(input: TurmaInput): void {
  if (!input.name?.trim()) {
    throw new ValidationError("name", "Nome é obrigatório.");
  }

  if (!input.slug?.trim()) {
    throw new ValidationError("slug", "Slug é obrigatório.");
  }

  if (!SLUG_RE.test(input.slug)) {
    throw new ValidationError(
      "slug",
      "Slug deve conter apenas letras minúsculas, números e hífens."
    );
  }

  if (
    input.startsAt &&
    input.endsAt &&
    new Date(input.endsAt) < new Date(input.startsAt)
  ) {
    throw new ValidationError(
      "endsAt",
      "Data de término não pode ser anterior à data de início."
    );
  }

  const validStatuses = ["draft", "active", "inactive", "archived"];
  if (!validStatuses.includes(input.status)) {
    throw new ValidationError("status", "Status inválido.");
  }
}

export function validateProductInput(input: ProductInput): void {
  if (!input.name?.trim()) {
    throw new ValidationError("name", "Nome é obrigatório.");
  }

  if (!input.slug?.trim()) {
    throw new ValidationError("slug", "Slug é obrigatório.");
  }

  if (!SLUG_RE.test(input.slug)) {
    throw new ValidationError(
      "slug",
      "Slug deve conter apenas letras minúsculas, números e hífens."
    );
  }

  if (
    !Number.isInteger(input.unitAmountCents) ||
    input.unitAmountCents <= 0
  ) {
    throw new ValidationError(
      "unitAmountCents",
      "Preço deve ser um número inteiro em centavos maior que zero."
    );
  }

  if (!["brl", "usd"].includes(input.currency)) {
    throw new ValidationError("currency", "Moeda inválida.");
  }

  if (
    !Number.isInteger(input.maxQuantity) ||
    input.maxQuantity < 1 ||
    input.maxQuantity > 10
  ) {
    throw new ValidationError(
      "maxQuantity",
      "Quantidade máxima deve ser entre 1 e 10."
    );
  }

  if (
    !Array.isArray(input.installmentOptions) ||
    input.installmentOptions.length === 0
  ) {
    throw new ValidationError(
      "installmentOptions",
      "Pelo menos uma opção de parcelamento é obrigatória."
    );
  }

  const invalidInstallments = input.installmentOptions.filter(
    (i) => !ALLOWED_INSTALLMENTS.includes(i as 1 | 2 | 3 | 6 | 12)
  );
  if (invalidInstallments.length > 0) {
    throw new ValidationError(
      "installmentOptions",
      "Parcelas permitidas: 1, 2, 3, 6 ou 12."
    );
  }

  const installmentRates = input.installmentRates ?? {};
  const invalidInstallmentRateEntries = Object.entries(installmentRates).filter(
    ([installments, ratePct]) =>
      !input.installmentOptions.includes(Number(installments) as 1 | 2 | 3 | 6 | 12) ||
      !Number.isFinite(ratePct) ||
      ratePct < 0 ||
      ratePct > 999.99
  );
  if (invalidInstallmentRateEntries.length > 0) {
    throw new ValidationError(
      "installmentRates",
      "Taxas de juros devem usar parcelas configuradas e percentuais entre 0 e 999,99."
    );
  }

  if (
    !Array.isArray(input.paymentMethods) ||
    input.paymentMethods.length === 0
  ) {
    throw new ValidationError(
      "paymentMethods",
      "Selecione pelo menos um método de pagamento."
    );
  }

  const invalidPaymentMethods = input.paymentMethods.filter(
    (method) => !ALLOWED_PAYMENT_METHODS.includes(method)
  );
  if (invalidPaymentMethods.length > 0) {
    throw new ValidationError(
      "paymentMethods",
      "Métodos permitidos: cartão, Pix, Klarna ou Afterpay/Clearpay."
    );
  }

  if (
    input.paymentMethods.includes("klarna") &&
    !input.installmentOptions.some((installment) => installment > 1)
  ) {
    throw new ValidationError(
      "paymentMethods",
      "Klarna deve ser usado apenas em produtos com parcelamento maior que 1x."
    );
  }
}

export function validateCouponInput(input: CouponInput): void {
  if (!input.code?.trim()) {
    throw new ValidationError("code", "Código do cupom é obrigatório.");
  }

  const normalizedCode = input.code.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(normalizedCode)) {
    throw new ValidationError(
      "code",
      "Código deve conter apenas letras maiúsculas, números, hífens ou underscores (2-50 caracteres)."
    );
  }

  if (!input.name?.trim()) {
    throw new ValidationError("name", "Nome do cupom é obrigatório.");
  }

  if (!["percent", "fixed_amount"].includes(input.discountType)) {
    throw new ValidationError("discountType", "Tipo de desconto inválido.");
  }

  if (!Number.isInteger(input.discountValue) || input.discountValue <= 0) {
    throw new ValidationError(
      "discountValue",
      "Valor do desconto deve ser um inteiro positivo."
    );
  }

  if (input.discountType === "percent" && input.discountValue > 100) {
    throw new ValidationError(
      "discountValue",
      "Desconto percentual não pode exceder 100%."
    );
  }

  if (!["brl", "usd"].includes(input.currency)) {
    throw new ValidationError("currency", "Moeda inválida.");
  }

  if (
    input.startsAt &&
    input.endsAt &&
    new Date(input.endsAt) < new Date(input.startsAt)
  ) {
    throw new ValidationError(
      "endsAt",
      "Data de término não pode ser anterior à data de início."
    );
  }

  if (
    input.maxRedemptions !== undefined &&
    input.maxRedemptions !== null &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions <= 0)
  ) {
    throw new ValidationError(
      "maxRedemptions",
      "Limite de usos deve ser um inteiro positivo."
    );
  }
}

export function validateSellerInput(input: SellerInput): void {
  if (!input.slug?.trim()) {
    throw new ValidationError("slug", "Slug é obrigatório.");
  }

  if (!SLUG_RE.test(input.slug)) {
    throw new ValidationError(
      "slug",
      "Slug deve conter apenas letras minúsculas, números e hífens."
    );
  }

  if (!input.name?.trim()) {
    throw new ValidationError("name", "Nome é obrigatório.");
  }
}
