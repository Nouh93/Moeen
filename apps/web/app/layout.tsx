import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "./sw-register";

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
    <html lang="ar" dir="rtl">
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
