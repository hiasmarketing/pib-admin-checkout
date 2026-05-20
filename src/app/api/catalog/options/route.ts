import { listPublicCheckoutOptions } from "@/lib/catalog/resolve";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const options = await listPublicCheckoutOptions();
    return Response.json(
      { options },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return Response.json({ error: "Erro ao buscar opções de checkout." }, { status: 500 });
  }
}
