import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PipedriveSyncJobType } from "@/lib/pipedrive/types";

export async function enqueuePipedriveSyncJob(params: {
  type: PipedriveSyncJobType;
  aggregateType: "lead" | "order";
  aggregateId: string;
  payload?: Record<string, unknown>;
  nextAttemptAt?: Date;
}): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .insert({
      type: params.type,
      aggregate_type: params.aggregateType,
      aggregate_id: params.aggregateId,
      payload: params.payload ?? {},
      next_attempt_at: params.nextAttemptAt?.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw new Error("Falha ao enfileirar sync Pipedrive.");
  }

  return data.id as string;
}

export function computePipedriveNextAttempt(attemptCount: number): Date {
  const delayMs = Math.min(60_000 * Math.pow(3, attemptCount), 3_600_000);
  return new Date(Date.now() + delayMs);
}
