import type { Metadata } from "next";
import { DM_Sans, Inter, Rethink_Sans, Sora } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  GoogleTagManagerHead,
  GoogleTagManagerNoScript,
} from "@/components/tracking/GoogleTagManager";
import { routing } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sora = Sora({
  variable: "--font-sora-var",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink-sans-var",
  subsets: ["latin"],
  weight: ["600"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans-var",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Método Destiny",
  description: "Imersão presencial — garanta seu ingresso",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "pt" | "en")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable} ${rethinkSans.variable} ${dmSans.variable}`}>
      <head>
        <GoogleTagManagerHead />
      </head>
      <body>
        <GoogleTagManagerNoScript />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
