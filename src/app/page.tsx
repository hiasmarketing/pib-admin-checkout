import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRootRedirectPath } from "@/lib/public-urls";
import { appendSearchParamsObject } from "@/lib/url";

type RootPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RootPage({ searchParams }: RootPageProps) {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const destination = appendSearchParamsObject(
    getRootRedirectPath({ host }),
    await searchParams
  );

  redirect(destination);
}
