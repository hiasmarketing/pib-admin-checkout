import { getSupabaseAdmin } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!UUID_RE.test(orderId)) {
    return jsonError("Pedido inválido.", 400);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "id, status, quantity, total_amount_cents, currency, created_at, paid_at, turma_id, turma_name, product_name, coupon_code_snapshot, pagarme_decline_code, pagarme_failure_message, turma:turmas(whatsapp_group_url)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Failed to lookup public order", error);
    return jsonError("Não foi possível carregar o pedido agora.", 500);
  }

  if (!data) {
    return jsonError("Pedido não encontrado.", 404);
  }

  const turmaJoined = (data as { turma?: { whatsapp_group_url: string | null } | { whatsapp_group_url: string | null }[] | null }).turma;
  const turma = Array.isArray(turmaJoined) ? turmaJoined[0] ?? null : turmaJoined;

  return Response.json({
    id: data.id,
    status: data.status,
    quantity: data.quantity,
    totalAmountCents: data.total_amount_cents,
    currency: data.currency,
    createdAt: data.created_at,
    paidAt: data.paid_at,
    turmaName: data.turma_name ?? null,
    productName: data.product_name ?? null,
    couponCode: data.coupon_code_snapshot ?? null,
    pagarmeDeclineCode: data.pagarme_decline_code ?? null,
    pagarmeFailureMessage: data.pagarme_failure_message ?? null,
    whatsappGroupUrl: turma?.whatsapp_group_url ?? null,
  });
}
