"use client";

import { loadTracking } from "@/lib/tracking";

export interface CheckoutLeadContact {
  name: string;
  email: string;
  phone: string;
}

const LEAD_ID_KEY = "pib_lead_id";
const LEAD_CONTACT_KEY = "pib_lead_contact";
const CONTACT_KEY = "pib_contact";
// Compat: ler sessões legadas com prefixo destiny_* por 7 dias após deploy.
const LEGACY_LEAD_ID_KEY = "destiny_lead_id";
const LEGACY_LEAD_CONTACT_KEY = "destiny_lead_contact";
const LEGACY_CONTACT_KEY = "destiny_contact";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readWithLegacy(primary: string, legacy: string): string | null {
  return sessionStorage.getItem(primary) ?? sessionStorage.getItem(legacy);
}

function parseContact(raw: string | null): CheckoutLeadContact | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutLeadContact>;
    const contact = {
      name: typeof parsed.name === "string" ? parsed.name.trim() : "",
      email: typeof parsed.email === "string" ? parsed.email.trim() : "",
      phone: typeof parsed.phone === "string" ? parsed.phone.trim() : "",
    };

    return contact.name && contact.email && contact.phone ? contact : null;
  } catch {
    return null;
  }
}

export function getStoredCheckoutLeadId(): string | null {
  const leadId = readWithLegacy(LEAD_ID_KEY, LEGACY_LEAD_ID_KEY);
  if (leadId && UUID_RE.test(leadId)) return leadId;

  sessionStorage.removeItem(LEAD_ID_KEY);
  sessionStorage.removeItem(LEGACY_LEAD_ID_KEY);
  sessionStorage.removeItem("pib_order_id");
  sessionStorage.removeItem("destiny_order_id");
  return null;
}

export function getStoredCheckoutContact(): CheckoutLeadContact | null {
  return (
    parseContact(readWithLegacy(LEAD_CONTACT_KEY, LEGACY_LEAD_CONTACT_KEY)) ??
    parseContact(readWithLegacy(CONTACT_KEY, LEGACY_CONTACT_KEY))
  );
}

export async function ensureCheckoutLeadId(): Promise<string | null> {
  const existingLeadId = getStoredCheckoutLeadId();
  if (existingLeadId) return existingLeadId;

  const contact = getStoredCheckoutContact();
  if (!contact) return null;

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        tracking: loadTracking(),
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { leadId?: string }
      | null;

    if (!response.ok || !data?.leadId || !UUID_RE.test(data.leadId)) {
      return null;
    }

    const serializedContact = JSON.stringify(contact);
    sessionStorage.setItem(LEAD_ID_KEY, data.leadId);
    sessionStorage.setItem(LEAD_CONTACT_KEY, serializedContact);
    sessionStorage.setItem(CONTACT_KEY, serializedContact);
    return data.leadId;
  } catch {
    return null;
  }
}
