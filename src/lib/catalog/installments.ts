export interface InstallmentInterestResult {
  totalCents: number;
  perInstallmentCents: number;
  interestRatePct: number | null;
}

export function applyInstallmentInterest(
  amountCents: number,
  installments: number,
  installmentRatePct?: number | null
): InstallmentInterestResult {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }

  if (!Number.isInteger(installments) || installments <= 0) {
    throw new Error("installments must be a positive integer.");
  }

  if (
    installmentRatePct != null &&
    (!Number.isFinite(installmentRatePct) || installmentRatePct < 0)
  ) {
    throw new Error("installmentRatePct must be a non-negative number.");
  }

  if (installments > 1 && installmentRatePct != null && installmentRatePct > 0) {
    const monthlyRate = installmentRatePct / 100;
    const installmentAmount =
      amountCents * monthlyRate / (1 - Math.pow(1 + monthlyRate, -installments));

    return {
      totalCents: Math.ceil(installmentAmount * installments),
      perInstallmentCents: Math.ceil(installmentAmount),
      interestRatePct: installmentRatePct,
    };
  }

  return {
    totalCents: amountCents,
    perInstallmentCents: Math.ceil(amountCents / installments),
    interestRatePct: null,
  };
}
