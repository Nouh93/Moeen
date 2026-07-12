/**
 * Service Worker — أساس PWA (القسم 22.1 بالملحق):
 * - الأصول الثابتة والصور: cache-first (تُعرض حتى بدون إنترنت بعد أول تحميل)
 * - الصفحات: network-first مع الرجوع للنسخة المخزنة عند الانقطاع
 *
 * قاعدة ذهبية: لا تُخزَّن أبداً استجابة غير ناجحة — تخزين 404 لملف
 * سكربت أثناء لحظة نشر يقتل تفاعل الصفحة للأبد على جهاز الزائر.
 * رفع رقم النسخة يمسح الكاش القديم من كل الأجهزة عند أول زيارة.
 */
const CACHE = "moeen-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // الصور والأصول الثابتة: cache-first
  const isStatic =
    request.destination === "image" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/_next/static/");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // صفحات التصفح: network-first ثم الكاش عند الانقطاع
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
  }
});
