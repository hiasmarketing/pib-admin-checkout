import "server-only";

import { getPipedriveConfig } from "@/lib/pipedrive/config";

interface PipedriveEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  error_info?: string;
}

export class PipedriveApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean
  ) {
    super(message);
    this.name = "PipedriveApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getPipedriveConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-token": config.apiToken,
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await response.json().catch(() => null)) as
    | PipedriveEnvelope<T>
    | null;

  if (!response.ok || body?.success === false) {
    throw new PipedriveApiError(
      body?.error ??
        body?.error_info ??
        `Pipedrive request failed: ${response.status}`,
      response.status,
      response.status === 429 || response.status >= 500
    );
  }

  return (body?.data ?? body) as T;
}

export const pipedriveClient = {
  searchPersons: (term: string) =>
    request<unknown>(`/v2/persons/search?term=${encodeURIComponent(term)}`),
  createPerson: (payload: unknown) =>
    request<unknown>("/v2/persons", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePerson: (id: number, payload: unknown) =>
    request<unknown>(`/v2/persons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createLead: (payload: unknown) =>
    request<unknown>("/v1/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLead: (id: string, payload: unknown) =>
    request<unknown>(`/v1/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createDeal: (payload: unknown) =>
    request<unknown>("/v2/deals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDeal: (id: number, payload: unknown) =>
    request<unknown>(`/v2/deals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  convertLeadToDeal: (leadId: string, payload: unknown) =>
    request<unknown>(`/v2/leads/${leadId}/convert/deal`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  searchProducts: (term: string) =>
    request<unknown>(`/v1/products/search?term=${encodeURIComponent(term)}`),
  createProduct: (payload: unknown) =>
    request<unknown>("/v1/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDealProducts: (dealId: number) =>
    request<unknown>(`/v1/deals/${dealId}/products`),
  addProductToDeal: (dealId: number, payload: unknown) =>
    request<unknown>(`/v1/deals/${dealId}/products`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
