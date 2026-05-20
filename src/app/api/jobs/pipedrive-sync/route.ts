import { getAdminJobEnv } from "@/lib/env";
import { runDuePipedriveSyncJobs } from "@/lib/pipedrive/runner";

export async function GET(request: Request) {
  const { adminJobSecret } = getAdminJobEnv();
  const auth = request.headers.get("authorization");

  if (!auth || auth !== `Bearer ${adminJobSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runDuePipedriveSyncJobs(new Date());
    return Response.json(result);
  } catch (err) {
    console.error("pipedrive-sync: runner error", err);
    return Response.json(
      { error: "Erro ao processar sync Pipedrive." },
      { status: 500 }
    );
  }
}
