import "server-only";

export const FORBIDDEN_CLIENT_PRICING_FIELDS = [
  "amount",
  "amountCents",
  "unitAmount",
  "unitAmountCents",
  "subtotalAmount",
  "subtotalAmountCents",
  "discountAmount",
  "discountAmountCents",
  "totalAmount",
  "totalAmountCents",
  "price",
  "currency",
  "pricing",
];

export function hasClientPricingOverride(payload: Record<string, unknown>) {
  return FORBIDDEN_CLIENT_PRICING_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );
}
