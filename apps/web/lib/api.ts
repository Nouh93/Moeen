/** عميل API موحّد للواجهة */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function api<T = any>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body?.message)
      ? body.message[0]
      : (body?.message ?? "حدث خطأ مؤقت — حاول مرة ثانية بعد قليل");
    throw new Error(msg);
  }
  return body as T;
}

/** رفع ملف (صورة) — يعيد رابط الصورة */
export async function uploadFile(file: File, token: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? "فشل رفع الصورة — جرب صورة أصغر");
  }
  return body.url as string;
}

/** الصور المرفوعة روابطها نسبية على الـ API */
export function imgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

export function formatPrice(value: string | number, currency: string): string {
  const n = Number(value);
  const label: Record<string, string> = {
    YER_SANAA: "ريال",
    YER_ADEN: "ريال (عدن)",
    USD: "$",
    SAR: "ر.س",
  };
  return `${n.toLocaleString("ar-YE")} ${label[currency] ?? ""}`.trim();
}
