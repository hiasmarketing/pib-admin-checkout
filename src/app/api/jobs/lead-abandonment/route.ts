import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createOutboundEvent,
  enqueueDeliveries,
} from "@/lib/webhooks/outbound";
import { getAdminJobEnv } from "@/lib/env";

export async function GET(request: Request) {
  const { adminJobSecret } = getAdminJobEnv();
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${adminJobSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Leads with at least one paid order are not abandoned
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("lead_id")
    .eq("status", "paid");

  const paidLeadIds = new Set(
    (paidOrders ?? []).map((o) => o.lead_id as string).filter(Boolean)
  );

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref, seller_id, seller_slug, seller_name, created_at"
    )
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("lead-abandonment: failed to fetch leads", error);
    return Response.json({ error: "Erro ao buscar leads." }, { status: 500 });
  }

  const abandonedLeads = (leads ?? []).filter(
    (l) => !paidLeadIds.has(l.id as string)
  );

  let processed = 0;
  let skipped = 0;

  for (const lead of abandonedLeads) {
    try {
      const eventId = await createOutboundEvent({
        type: "lead.abandoned",
        aggregateType: "lead",
        aggregateId: lead.id as string,
        payload: {
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          utmSource: lead.utm_source,
          utmMedium: lead.utm_medium,
          utmCampaign: lead.utm_campaign,
          utmContent: lead.utm_content,
          utmTerm: lead.utm_term,
          ref: lead.ref,
          sellerId: lead.seller_id,
          sellerSlug: lead.seller_slug,
          sellerName: lead.seller_name,
          createdAt: lead.created_at,
          abandonedAt: new Date().toISOString(),
        },
      });

      if (eventId) {
        await enqueueDeliveries(eventId);
        processed++;
      } else {
        skipped++; // idempotent: event already existed
      }
    } catch (err) {
      console.error(
        "lead-abandonment: error processing lead",
        lead.id,
        err
      );
    }
  }

  return Response.json({ processed, skipped, total: abandonedLeads.length });
}
