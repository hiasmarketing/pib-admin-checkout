"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { appendSearchParams } from "@/lib/url";

function getAlternateLocalePath(pathname: string) {
  if (pathname === "/en") {
    return "/";
  }

  if (pathname.startsWith("/en/")) {
    return pathname.replace(/^\/en/, "") || "/";
  }

  if (pathname === "/") {
    return "/en";
  }

  return `/en${pathname}`;
}

interface LanguageToggleProps {
  positionClassName?: string;
}

export default function LanguageToggle({
  positionClassName = "right-4 top-4 md:right-8 md:top-8",
}: LanguageToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEnglish = pathname === "/en" || pathname.startsWith("/en/");
  const href = appendSearchParams(getAlternateLocalePath(pathname), searchParams);
  const nextLocale = isEnglish ? "pt" : "en";

  return (
    <div className={`fixed z-50 ${positionClassName}`}>
      <Link
        href={href}
        prefetch={false}
        aria-label={
          isEnglish ? "Mudar idioma para português" : "Change language to English"
        }
        onClick={() => {
          document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
        }}
        className="group inline-flex min-h-10 cursor-pointer items-center rounded-full border border-white/16 bg-black/55 p-1 font-sora text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_36px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/32 hover:bg-black/72"
      >
        <span
          className={`rounded-full px-3 py-2 transition ${
            !isEnglish ? "bg-white text-black" : "text-white/62"
          }`}
        >
          PT
        </span>
        <span
          className={`rounded-full px-3 py-2 transition ${
            isEnglish ? "bg-white text-black" : "text-white/62"
          }`}
        >
          EN
        </span>
      </Link>
    </div>
  );
}
