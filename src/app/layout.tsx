import type { Metadata } from "next";
import { DM_Sans, Montserrat, Rethink_Sans, Sora } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import {
  GoogleTagManagerHead,
  GoogleTagManagerNoScript,
} from "@/components/tracking/GoogleTagManager";
import "./globals.css";

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
  weight: ["500", "700"],
});

const montserrat = Montserrat({
  variable: "--font-inter-var",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PIB — Faria e Castro",
  description: "Imersão presencial — garanta seu ingresso",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html
      lang="pt"
      className={`${montserrat.variable} ${sora.variable} ${rethinkSans.variable} ${dmSans.variable}`}
    >
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
