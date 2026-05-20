import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveSeller } from "@/lib/catalog/sellers";
import {
  resolveSellerTrackingIdentifier,
  type TrackingData,
} from "@/lib/tracking";

interface LeadPayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  tracking?: TrackingData | null;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const hasExplicitCountryCode = trimmed.startsWith("+");
  let digits = value.replace(/\D/g, "");

  if (
    !hasExplicitCountryCode &&
    (digits.length === 10 || digits.length === 11) &&
    !digits.startsWith("55")
  ) {
    digits = `55${digits}`;
  }

  return digits ? `+${digits}` : "";
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return jsonError("Payload inválido.", 400);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const phone =
    typeof payload.phone === "string" ? normalizePhone(payload.phone) : "";

  const phoneDigits = phone.replace(/\D/g, "");

  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    phoneDigits.length < 11 ||
    phoneDigits.length > 15
  ) {
    return jsonError("Confira os dados de contato e tente novamente.", 400);
  }

  const tracking = payload.tracking ?? null;
  const rawSellerId = optionalText(tracking?.seller?.id);
  const rawSellerSlug = optionalText(tracking?.seller?.slug);
  const rawSellerName = optionalText(tracking?.seller?.name);
  const sellerIdentifier = resolveSellerTrackingIdentifier({
    sellerId: rawSellerId,
    sellerSlug: rawSellerSlug,
    sellerName: rawSellerName,
  });
  const sellerRecord =
    sellerIdentifier.sellerId || sellerIdentifier.sellerSlug
      ? await resolveSeller(sellerIdentifier)
      : null;

  const leadData = {
    name,
    email,
    phone,
    utm_source: optionalText(tracking?.utms?.utm_source),
    utm_medium: optionalText(tracking?.utms?.utm_medium),
    utm_campaign: optionalText(tracking?.utms?.utm_campaign),
    utm_content: optionalText(tracking?.utms?.utm_content),
    utm_term: optionalText(tracking?.utms?.utm_term),
    ref: optionalText(tracking?.utms?.ref),
    seller_id: sellerRecord?.sellerId ?? rawSellerId,
    seller_slug:
      sellerRecord?.slug ?? rawSellerSlug ?? sellerIdentifier.sellerSlug,
    seller_name: sellerRecord?.name ?? rawSellerName,
  };

  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create lead", error);
      return jsonError("Não foi possível salvar seus dados agora.", 500);
    }

    return Response.json({ leadId: data.id });
  } catch (error) {
    console.error("Unexpected lead persistence failure", error);
    return jsonError("Não foi possível salvar seus dados agora.", 500);
  }
}
