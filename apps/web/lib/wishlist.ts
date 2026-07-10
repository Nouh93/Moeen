"use client";

/**
 * المفضلة — تُحفظ محلياً في جهاز العميل لكل متجر على حدة (مثل السلة):
 * بلا تسجيل دخول وبلا إنترنت — يناسب واقع الاستخدام في اليمن.
 */
const key = (slug: string) => `moeen-wishlist-${slug}`;

export function getWishlist(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key(slug)) ?? "[]");
  } catch {
    return [];
  }
}

export function toggleWishlist(slug: string, productId: string): string[] {
  const list = getWishlist(slug);
  const next = list.includes(productId)
    ? list.filter((id) => id !== productId)
    : [...list, productId];
  localStorage.setItem(key(slug), JSON.stringify(next));
  return next;
}
