export type PipedriveSyncJobType =
  | "lead.created"
  | "order.created"
  | "order.paid"
  | "order.payment_failed";

export type PipedriveSyncJobStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "dead";

export interface PipedrivePersonInput {
  name: string;
  email: string;
  phone: string | null;
  ownerId?: number | null;
}

export interface PipedriveLeadInput {
  title: string;
  personId: number;
  ownerId?: number | null;
  value?: { amount: number; currency: string } | null;
  labelIds?: string[];
  customFields: Record<string, string | number | (string | number)[] | null>;
}

export interface PipedriveDealInput {
  title: string;
  personId: number;
  value: number;
  currency: string;
  pipelineId?: number | null;
  stageId?: number | null;
  ownerId?: number | null;
  status?: "open" | "won" | "lost";
  customFields: Record<string, string | number | (string | number)[] | null>;
}
