import "server-only";

import { PipedriveApiError } from "@/lib/pipedrive/client";
import { computePipedriveNextAttempt } from "@/lib/pipedrive/jobs";
import {
  syncFailedOrderToPipedrive,
  syncLeadToPipedrive,
  syncOrderToPipedrive,
  syncPaidOrderToPipedrive,
} from "@/lib/pipedrive/sync";
import type {
  PipedriveSyncJobStatus,
  PipedriveSyncJobType,
} from "@/lib/pipedrive/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_RETRIES = 6;
const JOB_LIMIT = 25;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

interface PipedriveSyncJobRow {
  id: string;
  type: PipedriveSyncJobType;
  status: PipedriveSyncJobStatus;
  aggregate_id: string;
  attempt_count: number;
}

async function loadDueJobs(now: Date): Promise<PipedriveSyncJobRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .select("id, type, status, aggregate_id, attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(JOB_LIMIT);

  if (error) throw new Error("Falha ao listar jobs Pipedrive.");

  return (data ?? []) as PipedriveSyncJobRow[];
}

async function recoverStaleProcessingJobs(now: Date): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const { data, error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .update({
      status: "failed",
      next_attempt_at: now.toISOString(),
      last_error: "Job Pipedrive recuperado após ficar preso em processing.",
    })
    .eq("status", "processing")
    .lt("last_attempt_at", staleBefore.toISOString())
    .select("id");

  if (error) throw new Error("Falha ao recuperar jobs Pipedrive travados.");

  return data?.length ?? 0;
}

async function markProcessing(job: PipedriveSyncJobRow, now: Date) {
  const { data, error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .update({
      status: "processing",
      last_attempt_at: now.toISOString(),
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .select("id")
    .maybeSingle();

  if (error) throw new Error("Falha ao bloquear job Pipedrive.");

  return !!data;
}

async function markSucceeded(jobId: string) {
  const { error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .update({
      status: "succeeded",
      succeeded_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", jobId);

  if (error) throw new Error("Falha ao concluir job Pipedrive.");
}

async function markFailed(
  jobId: string,
  values: {
    status: "failed" | "dead";
    attemptCount: number;
    nextAttemptAt: Date;
    error: string;
  }
) {
  const { error } = await getSupabaseAdmin()
    .from("pipedrive_sync_jobs")
    .update({
      status: values.status,
      attempt_count: values.attemptCount,
      next_attempt_at: values.nextAttemptAt.toISOString(),
      last_error: values.error,
    })
    .eq("id", jobId);

  if (error) throw new Error("Falha ao registrar erro de job Pipedrive.");
}

async function processJob(job: PipedriveSyncJobRow) {
  if (job.type === "lead.created") {
    await syncLeadToPipedrive(job.aggregate_id);
    return;
  }

  if (job.type === "order.created") {
    await syncOrderToPipedrive(job.aggregate_id);
    return;
  }

  if (job.type === "order.paid") {
    await syncPaidOrderToPipedrive(job.aggregate_id);
    return;
  }

  if (job.type === "order.payment_failed") {
    await syncFailedOrderToPipedrive(job.aggregate_id);
  }
}

export async function runDuePipedriveSyncJobs(now: Date): Promise<{
  processed: number;
  failed: number;
  dead: number;
  recovered: number;
}> {
  const recovered = await recoverStaleProcessingJobs(now);
  const jobs = await loadDueJobs(now);
  let processed = 0;
  let failed = 0;
  let dead = 0;

  for (const job of jobs) {
    const locked = await markProcessing(job, now);
    if (!locked) continue;

    try {
      await processJob(job);
      await markSucceeded(job.id);
      processed++;
    } catch (err) {
      const retryable = err instanceof PipedriveApiError ? err.retryable : true;
      const attempts = job.attempt_count + 1;
      const nextStatus =
        !retryable || attempts >= MAX_RETRIES ? "dead" : "failed";

      await markFailed(job.id, {
        status: nextStatus,
        attemptCount: attempts,
        nextAttemptAt: computePipedriveNextAttempt(attempts),
        error: err instanceof Error ? err.message : "Unknown error",
      });

      if (nextStatus === "dead") dead++;
      else failed++;
    }
  }

  return { processed, failed, dead, recovered };
}
