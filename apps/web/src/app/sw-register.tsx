"use client";

import { useEffect } from "react";

/** يسجّل service worker لدعم العمل أوفلاين (متطلب القسم 22 من الـPRD). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* تجاهل بصمت — التطبيق يعمل بدون SW أيضاً */
      });
    }
  }, []);
  return null;
}
