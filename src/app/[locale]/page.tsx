import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRootRedirectPath } from "@/lib/public-urls";
import { appendSearchParamsObject } from "@/lib/url";

type LocaleRootPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({
  params,
  searchParams,
}: LocaleRootPageProps) {
  const [{ locale }, headersList, resolvedSearchParams] = await Promise.all([
    params,
    headers(),
    searchParams,
  ]);
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const destination = appendSearchParamsObject(
    getRootRedirectPath({ host, locale }),
    resolvedSearchParams
  );

  redirect(destination);
}
