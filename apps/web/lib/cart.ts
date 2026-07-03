"use client";

/**
 * سلة التسوق — تُحفظ محلياً في جهاز العميل (localStorage) لكل متجر على حدة.
 * أساس سلوك Offline-First للعميل (القسم 22.1 بالملحق).
 */
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
}

const key = (slug: string) => `moeen-cart-${slug}`;

export function getCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key(slug)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCart(slug: string, items: CartItem[]) {
  localStorage.setItem(key(slug), JSON.stringify(items));
  window.dispatchEvent(new Event("moeen-cart-changed"));
}

export function addToCart(slug: string, item: Omit<CartItem, "quantity">) {
  const items = getCart(slug);
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) existing.quantity += 1;
  else items.push({ ...item, quantity: 1 });
  saveCart(slug, items);
}

export function clearCart(slug: string) {
  saveCart(slug, []);
}
