"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart, getCart } from "@/lib/cart";

/** زر السلة في رأس المتجر مع عدّاد */
export function CartLink({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () =>
      setCount(getCart(slug).reduce((s, i) => s + i.quantity, 0));
    update();
    window.addEventListener("moeen-cart-changed", update);
    return () => window.removeEventListener("moeen-cart-changed", update);
  }, [slug]);

  return (
    <Link
      href={`/s/${slug}/cart`}
      className="relative bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2 font-semibold shrink-0"
    >
      🛒 السلة
      {count > 0 && (
        <span className="absolute -top-2 -left-2 bg-amber-400 text-brand-900 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}

/** زر أضف للسلة في صفحة المنتج */
export function AddToCartButton({
  slug,
  product,
  disabled,
}: {
  slug: string;
  product: { id: string; name: string; price: number; imageUrl?: string | null };
  disabled?: boolean;
}) {
  const [added, setAdded] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={() => {
        addToCart(slug, {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          imageUrl: product.imageUrl,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-bold text-lg hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
    >
      {disabled ? "نفدت الكمية" : added ? "أُضيف للسلة ✓" : "أضف للسلة 🛒"}
    </button>
  );
}
