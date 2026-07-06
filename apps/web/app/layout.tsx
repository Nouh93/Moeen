import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { SwRegister } from "./sw-register";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
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
  themeColor: "#115e59",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
