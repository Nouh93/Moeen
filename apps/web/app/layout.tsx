import type { Metadata, Viewport } from "next";
import { Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { SwRegister } from "./sw-register";

// Alexandria: هندسي حديث للعناوين — IBM Plex Sans Arabic: مقروء ومحترف للنصوص
const alexandria = Alexandria({
  subsets: ["arabic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مُعين — منصة المتاجر اليمنية",
  description:
    "أنشئ متجرك الإلكتروني خلال دقائق — الدفع عند الاستلام، التوصيل داخل اليمن، وإشعارات واتساب",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#14172b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${plexArabic.variable}`}>
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
