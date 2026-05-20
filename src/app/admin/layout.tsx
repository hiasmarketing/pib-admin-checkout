import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { AdminToaster } from "@/components/admin/AdminToaster";
import "./admin.css";

const sora = Sora({
  variable: "--font-sora-var",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Admin — Método Destiny",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
  ],
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" className={`${sora.variable} ${inter.variable}`}>
      <head>
        {/* Apply stored theme before first paint to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('admin-theme');if(t==='light')document.documentElement.setAttribute('data-admin-theme','light')}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <AdminToaster />
      </body>
    </html>
  );
}
