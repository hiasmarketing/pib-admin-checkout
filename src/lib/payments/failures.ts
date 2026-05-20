import "server-only";

export interface StripeFailureDetails {
  paymentIntentId: string | null;
  stripeDeclineCode: string | null;
  stripeFailureCode: string | null;
  stripeFailureMessage: string | null;
  normalizedReason: string;
}

const STRIPE_FAILURE_REASONS: Record<string, string> = {
  insufficient_funds: "Saldo insuficiente",
  expired_card: "Cartao vencido",
  generic_decline: "Cartao recusado",
  card_declined: "Cartao recusado",
  incorrect_cvc: "CVV incorreto",
  invalid_cvc: "CVV invalido",
  processing_error: "Erro de processamento",
  authentication_required: "Autenticacao necessaria",
  amount_too_large: "Valor acima do limite do metodo de pagamento",
  amount_too_small: "Valor abaixo do limite do metodo de pagamento",
  payment_intent_payment_attempt_failed: "Pagamento recusado pelo provedor",
  payment_intent_payment_attempt_expired: "Sessao de pagamento expirada",
  payment_method_not_available: "Metodo de pagamento indisponivel",
  payment_method_provider_decline: "Pagamento recusado pelo provedor",
};

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getStripeFailureReason(params: {
  stripeDeclineCode?: string | null;
  stripeFailureCode?: string | null;
  stripeFailureMessage?: string | null;
}): string {
  const code = params.stripeDeclineCode ?? params.stripeFailureCode;
  if (code && STRIPE_FAILURE_REASONS[code]) return STRIPE_FAILURE_REASONS[code];
  return params.stripeFailureMessage ?? "Pagamento recusado";
}

export function getStripeErrorFailureDetails(
  error: unknown
): StripeFailureDetails | null {
  const record = asRecord(error);
  if (!record) return null;

  const paymentIntent = asRecord(record.payment_intent);
  const lastError = asRecord(paymentIntent?.last_payment_error);
  const stripeDeclineCode =
    optionalString(lastError?.decline_code) ?? optionalString(record.decline_code);
  const stripeFailureCode =
    optionalString(lastError?.code) ?? optionalString(record.code);
  const stripeFailureMessage =
    optionalString(lastError?.message) ??
    optionalString(record.userMessage) ??
    optionalString(record.message);
  const paymentIntentId = optionalString(paymentIntent?.id);
  const errorType = optionalString(record.type);
  const isCardFailure =
    errorType === "StripeCardError" ||
    errorType === "card_error" ||
    Boolean(paymentIntentId && (stripeDeclineCode || stripeFailureCode));

  if (!isCardFailure) return null;

  return {
    paymentIntentId,
    stripeDeclineCode,
    stripeFailureCode,
    stripeFailureMessage,
    normalizedReason: getStripeFailureReason({
      stripeDeclineCode,
      stripeFailureCode,
      stripeFailureMessage,
    }),
  };
}
