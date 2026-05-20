import { listPublicCheckoutOptions } from "@/lib/catalog/resolve";

export async function GET() {
  try {
    const options = await listPublicCheckoutOptions();
    return Response.json({ options });
  } catch {
    return Response.json({ error: "Erro ao buscar opções de checkout." }, { status: 500 });
  }
}
