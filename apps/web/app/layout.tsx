import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مُعين — منصة المتاجر اليمنية",
  description:
    "أنشئ متجرك الإلكتروني خلال دقائق — الدفع عند الاستلام، التوصيل داخل اليمن، وإشعارات واتساب",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
