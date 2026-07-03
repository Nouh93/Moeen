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
