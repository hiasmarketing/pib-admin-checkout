import "server-only";

import { getPipedriveEnv } from "@/lib/env";

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Configuração Pipedrive inválida.");
  }

  return parsed;
}

function parseCustomFieldMap(value: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("PIPEDRIVE_CUSTOM_FIELDS_JSON inválido.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PIPEDRIVE_CUSTOM_FIELDS_JSON deve ser um objeto.");
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" &&
        typeof entry[1] === "string" &&
        entry[1].trim().length > 0
    )
  );
}

function parsePaymentMethodOptionMap(value: string): Record<string, string | number> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("PIPEDRIVE_PAYMENT_METHOD_OPTION_MAP inválido.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PIPEDRIVE_PAYMENT_METHOD_OPTION_MAP deve ser um objeto.");
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[0] === "string" &&
        (typeof entry[1] === "string" || typeof entry[1] === "number") &&
        String(entry[1]).trim().length > 0
    )
  );
}

function parseLabelIds(value: string): string[] {
  if (!value.trim()) return [];

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getPipedriveConfig() {
  const env = getPipedriveEnv();
  const companyDomain = env.pipedriveCompanyDomain.trim();

  if (!companyDomain || companyDomain.includes("/") || companyDomain.includes(".")) {
    throw new Error("PIPEDRIVE_COMPANY_DOMAIN inválido.");
  }

  return {
    apiToken: env.pipedriveApiToken,
    baseUrl: `https://${companyDomain}.pipedrive.com/api`,
    ownerId: parseOptionalNumber(env.pipedriveOwnerId),
    pipelineId: parseOptionalNumber(env.pipedrivePipelineId),
    pendingStageId: parseOptionalNumber(env.pipedrivePendingStageId),
    paidStageId: parseOptionalNumber(env.pipedrivePaidStageId),
    failedStageId: parseOptionalNumber(env.pipedriveFailedStageId),
    leadLabelIds: parseLabelIds(env.pipedriveLeadLabelIds),
    paymentMethodOptionMap: parsePaymentMethodOptionMap(
      env.pipedrivePaymentMethodOptionMap
    ),
    customFields: parseCustomFieldMap(env.pipedriveCustomFieldsJson),
  };
}
