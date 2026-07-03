"use client";

import { useEffect } from "react";

/** تسجيل Service Worker — PWA (القسم 22.1 بالملحق) */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
