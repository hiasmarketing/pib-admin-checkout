import "server-only";

const PAGARME_FAILURE_REASONS: Record<string, string> = {
  insufficient_funds: "Saldo insuficiente",
  expired_card: "Cartão vencido",
  generic_decline: "Cartão recusado",
  card_declined: "Cartão recusado",
  invalid_card: "Cartão inválido",
  incorrect_cvc: "CVV incorreto",
  invalid_cvc: "CVV inválido",
  processing_error: "Erro de processamento",
  authentication_required: "Autenticação necessária",
  do_not_honor: "Cartão recusado pelo emissor",
  not_supported: "Operação não suportada",
  fraudulent: "Suspeita de fraude — verifique com o emissor",
};

export function getPagarmeFailureReason(params: {
  pagarmeDeclineCode?: string | null;
  pagarmeFailureMessage?: string | null;
}): string {
  const code = params.pagarmeDeclineCode;
  if (code && PAGARME_FAILURE_REASONS[code]) return PAGARME_FAILURE_REASONS[code];
  return params.pagarmeFailureMessage ?? "Pagamento recusado";
}
