import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt"],
  defaultLocale: "pt",
  localePrefix: "never",
  localeDetection: false,
});
