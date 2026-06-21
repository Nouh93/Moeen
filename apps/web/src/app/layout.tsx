import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "مُعين — منصة تجارة وتوصيل لليمن",
  description: "منصة تجارة وتوصيل مصمّمة لليمن: متاجر، طلبات، توصيل، ومحفظة تاجر.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0e7c5a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="topbar">
          <a className="brand" href="/">
            مُعين
          </a>
          <nav className="row">
            <a href="/login">لوحة التاجر</a>
            <a href="/admin">الإدارة</a>
          </nav>
        </div>
        <main className="container">{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
