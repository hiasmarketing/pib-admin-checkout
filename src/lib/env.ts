import "server-only";

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnv() {
  return {
    supabaseUrl: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseSecretKey: readRequiredEnv("SUPABASE_SECRET_KEY"),
  };
}

export function getPagarmeEnv() {
  const pagarmeSecretKey = readRequiredEnv("PAGARME_SECRET_KEY");
  const defaultBaseUrl = pagarmeSecretKey.startsWith("sk_test_")
    ? "https://sdx-api.pagar.me/core/v5"
    : "https://api.pagar.me/core/v5";

  return {
    pagarmeSecretKey,
    pagarmeBaseUrl: (process.env.PAGARME_BASE_URL ?? defaultBaseUrl).replace(
      /\/+$/,
      ""
    ),
    pagarmeWebhookSecret: readRequiredEnv("PAGARME_WEBHOOK_SECRET"),
  };
}

export function getCheckoutEnv() {
  return {
    checkoutUnitAmountCents: readRequiredEnv("CHECKOUT_UNIT_AMOUNT_CENTS"),
  };
}

export function getAdminJobEnv() {
  return {
    adminJobSecret: readRequiredEnv("ADMIN_JOB_SECRET"),
  };
}

export function getWebhookEncryptionEnv() {
  return {
    webhookSecretEncryptionKey: readRequiredEnv(
      "OUTBOUND_WEBHOOK_SECRET_ENCRYPTION_KEY"
    ),
  };
}

export function getPublicSupabaseEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}
