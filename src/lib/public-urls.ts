const CHECKOUT_HOST = "checkout.pib.com.br";
const ADMIN_HOST = "admin.pib.com.br";

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

export function isAdminHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === ADMIN_HOST;
}

export function getCheckoutOrigin(): string {
  for (const value of [
    process.env.NEXT_PUBLIC_CHECKOUT_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    if (!value) continue;
    const origin = normalizeOrigin(value);
    if (origin) return origin;
  }

  return `https://${CHECKOUT_HOST}`;
}

export function getAdminOrigin(): string {
  for (const value of [
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!value) continue;
    const origin = normalizeOrigin(value);
    if (origin) return origin;
  }

  return `https://${ADMIN_HOST}`;
}

export function getRootRedirectPath(params: {
  host: string | null | undefined;
}): string {
  if (isAdminHost(params.host)) {
    return "/admin";
  }

  return "/formulario";
}
