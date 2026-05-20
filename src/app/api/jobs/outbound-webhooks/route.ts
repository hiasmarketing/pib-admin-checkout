import { sendDueDeliveries } from "@/lib/webhooks/outbound";
import { getAdminJobEnv } from "@/lib/env";

export async function GET(request: Request) {
  const { adminJobSecret } = getAdminJobEnv();
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${adminJobSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await sendDueDeliveries(new Date());
    return Response.json({ ok: true });
  } catch (err) {
    console.error("outbound-webhooks: runner error", err);
    return Response.json({ error: "Erro ao enviar deliveries." }, { status: 500 });
  }
}
