import "server-only";

export const ALLOWED_INSTALLMENTS = [1, 2, 3, 6, 12] as const;
export const MIN_TICKET_QUANTITY = 1;
export const MAX_TICKET_QUANTITY = 10;

export type InstallmentCount = (typeof ALLOWED_INSTALLMENTS)[number];

export interface PricingInput {
  quantity: number;
  installmentCount: number;
}

export interface PricingResult {
  quantity: number;
  installmentCount: InstallmentCount;
  unitAmountCents: number;
  totalAmountCents: number;
  currency: "brl";
}

export function isAllowedInstallment(value: number): value is InstallmentCount {
  return ALLOWED_INSTALLMENTS.includes(value as InstallmentCount);
}

// TEMPORARY FALLBACK — only used when no catalog product is selected.
// Remove once all production links use turma/product identifiers.
export function calculateFallbackOrderAmount(input: PricingInput): PricingResult {
  if (!Number.isInteger(input.quantity)) {
    throw new Error("Quantidade inválida.");
  }

  if (
    input.quantity < MIN_TICKET_QUANTITY ||
    input.quantity > MAX_TICKET_QUANTITY
  ) {
    throw new Error("Quantidade inválida.");
  }

  if (!Number.isInteger(input.installmentCount)) {
    throw new Error("Parcelamento inválido.");
  }

  if (!isAllowedInstallment(input.installmentCount)) {
    throw new Error("Parcelamento inválido.");
  }

  const unitAmountCents = Number(process.env.CHECKOUT_UNIT_AMOUNT_CENTS);

  if (!Number.isInteger(unitAmountCents) || unitAmountCents <= 0) {
    throw new Error(
      "Preço do checkout inválido. Configure um produto no admin."
    );
  }

  return {
    quantity: input.quantity,
    installmentCount: input.installmentCount,
    unitAmountCents,
    totalAmountCents: unitAmountCents * input.quantity,
    currency: "brl",
  };
}

export const calculateOrderAmount = calculateFallbackOrderAmount;
