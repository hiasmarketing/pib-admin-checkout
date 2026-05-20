import "server-only";

import { unstable_cache } from "next/cache";

export const ADMIN_CACHE_TAGS = {
  leads: "admin:leads",
  orders: "admin:orders",
  turmas: "admin:turmas",
  products: "admin:products",
  coupons: "admin:coupons",
  sellers: "admin:sellers",
  users: "admin:users",
  webhooks: "admin:webhooks",
} as const;

export type AdminCacheTag = (typeof ADMIN_CACHE_TAGS)[keyof typeof ADMIN_CACHE_TAGS];

const DEFAULT_REVALIDATE_SECONDS = 60;

export function cachedAdminQuery<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  tags: AdminCacheTag[],
  revalidate: number | false = DEFAULT_REVALIDATE_SECONDS,
): (...args: TArgs) => Promise<TResult> {
  return unstable_cache(fn, keyParts, {
    tags,
    revalidate: revalidate === false ? undefined : revalidate,
  });
}
