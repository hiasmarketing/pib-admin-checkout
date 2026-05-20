export type AfterpayEligibilityReason =
  | "unsupported_currency"
  | "unsupported_country"
  | "domestic_only"
  | "amount_too_small"
  | "amount_too_large";

export interface AfterpayEligibilityInput {
  amountCents: number;
  currency: string;
  buyerCountry: string;
  stripeAccountCountry: string;
}

export interface AfterpayEligibilityResult {
  eligible: boolean;
  reason?: AfterpayEligibilityReason;
  minAmountCents?: number;
  maxAmountCents?: number;
  requiredCurrency?: string;
}

interface AfterpayCountryRule {
  currency: string;
  minAmountCents: number;
  maxAmountCents: number;
}

const AFTERPAY_COUNTRY_RULES: Record<string, AfterpayCountryRule> = {
  AU: { currency: "aud", minAmountCents: 100, maxAmountCents: 400000 },
  CA: { currency: "cad", minAmountCents: 100, maxAmountCents: 200000 },
  GB: { currency: "gbp", minAmountCents: 100, maxAmountCents: 120000 },
  NZ: { currency: "nzd", minAmountCents: 100, maxAmountCents: 400000 },
  US: { currency: "usd", minAmountCents: 100, maxAmountCents: 400000 },
};

export class AfterpayEligibilityError extends Error {
  constructor(public readonly result: AfterpayEligibilityResult) {
    super(result.reason ?? "afterpay_ineligible");
    this.name = "AfterpayEligibilityError";
  }
}

function normalizeCountry(country: string) {
  return country.trim().toUpperCase();
}

function normalizeCurrency(currency: string) {
  return currency.trim().toLowerCase();
}

export function getAfterpayEligibility(
  input: AfterpayEligibilityInput
): AfterpayEligibilityResult {
  const accountCountry = normalizeCountry(input.stripeAccountCountry);
  const buyerCountry = normalizeCountry(input.buyerCountry);
  const currency = normalizeCurrency(input.currency);
  const rule = AFTERPAY_COUNTRY_RULES[accountCountry];

  if (!rule) {
    return { eligible: false, reason: "unsupported_country" };
  }

  if (!buyerCountry || buyerCountry !== accountCountry) {
    return {
      eligible: false,
      reason: "domestic_only",
      requiredCurrency: rule.currency,
      minAmountCents: rule.minAmountCents,
      maxAmountCents: rule.maxAmountCents,
    };
  }

  if (currency !== rule.currency) {
    return {
      eligible: false,
      reason: "unsupported_currency",
      requiredCurrency: rule.currency,
      minAmountCents: rule.minAmountCents,
      maxAmountCents: rule.maxAmountCents,
    };
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents < rule.minAmountCents) {
    return {
      eligible: false,
      reason: "amount_too_small",
      requiredCurrency: rule.currency,
      minAmountCents: rule.minAmountCents,
      maxAmountCents: rule.maxAmountCents,
    };
  }

  if (input.amountCents > rule.maxAmountCents) {
    return {
      eligible: false,
      reason: "amount_too_large",
      requiredCurrency: rule.currency,
      minAmountCents: rule.minAmountCents,
      maxAmountCents: rule.maxAmountCents,
    };
  }

  return {
    eligible: true,
    requiredCurrency: rule.currency,
    minAmountCents: rule.minAmountCents,
    maxAmountCents: rule.maxAmountCents,
  };
}

export function assertAfterpayEligible(input: AfterpayEligibilityInput): void {
  const result = getAfterpayEligibility(input);
  if (!result.eligible) {
    throw new AfterpayEligibilityError(result);
  }
}
