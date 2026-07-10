"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, ImageIcon, Search, Star } from "lucide-react";
import { formatPrice, imgUrl } from "@/lib/api";
import { getWishlist, toggleWishlist } from "@/lib/wishlist";

/** شبكة المنتجات مع التصنيفات والبحث — بحث عربي متسامح (القسم 6.5) */
export function ProductsBrowser({
  slug,
  currency,
  products,
  categories,
}: {
  slug: string;
  currency: string;
  products: any[];
  categories: any[];
}) {
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [wishOnly, setWishOnly] = useState(false);

  // تُقرأ بعد التحميل لتطابق العرض بين الخادم والمتصفح
  useEffect(() => setWishlist(getWishlist(slug)), [slug]);

  // تطبيع عربي بسيط: همزات، تاء مربوطة، ألف مقصورة، تشكيل
  const normalize = (s: string) =>
    s
      .replace(/[ً-ٟ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .toLowerCase();

  const visible = useMemo(() => {
    let list = products;
    if (wishOnly) list = list.filter((p) => wishlist.includes(p.id));
    if (category) list = list.filter((p) => p.categoryId === category);
    if (q.trim()) {
      const nq = normalize(q);
      list = list.filter(
        (p) =>
          normalize(p.name).includes(nq) ||
          (p.description && normalize(p.description).includes(nq)) ||
          (p.brand && normalize(p.brand).includes(nq)) ||
          (Array.isArray(p.tags) && p.tags.some((t: string) => normalize(t).includes(nq))),
      );
    }
    return list;
  }, [products, category, q, wishOnly, wishlist]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {wishlist.length > 0 && (
          <button
            onClick={() => setWishOnly(!wishOnly)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5 ${
              wishOnly ? "bg-rose-500 text-white" : "bg-white border hover:bg-gray-100"
            }`}
          >
            <Heart size={13} className={wishOnly ? "fill-white" : "fill-rose-500 text-rose-500"} />
            المفضلة ({wishlist.length})
          </button>
        )}
        {categories.length > 0 && (
          <>
            <button
              onClick={() => setCategory("")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                !category ? "bg-[var(--sf-600)] text-white" : "bg-white border hover:bg-gray-100"
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id === category ? "" : c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  category === c.id ? "bg-[var(--sf-600)] text-white" : "bg-white border hover:bg-gray-100"
                }`}
              >
                {c.name}
              </button>
            ))}
          </>
        )}
        <div className="relative flex-1 min-w-40">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
          className="border rounded-full pr-9 pl-4 py-1.5 text-sm w-full bg-white"
          placeholder="ابحث في المتجر..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-gray-500 py-20">
          {q || category ? "لا نتائج مطابقة — جرّب كلمة أخرى" : "لا توجد منتجات معروضة حالياً"}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/s/${slug}/p/${p.id}`}
              className="card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div className="relative aspect-square bg-gray-100 flex items-center justify-center text-5xl">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setWishlist(toggleWishlist(slug, p.id));
                  }}
                  title={wishlist.includes(p.id) ? "أزل من المفضلة" : "أضف للمفضلة"}
                  className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:scale-110"
                >
                  <Heart
                    size={16}
                    className={wishlist.includes(p.id) ? "fill-rose-500 text-rose-500" : "text-gray-400"}
                  />
                </button>
                {p.featured && (
                  <span className="absolute top-2 right-2 z-10 bg-amber-400 text-brand-950 text-[11px] font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1 shadow-sm">
                    <Star size={11} className="fill-brand-950" /> مميز
                  </span>
                )}
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(p.imageUrl)} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={40} className="text-gray-200" strokeWidth={1.2} />
                )}
              </div>
              <div className="p-3">
                <div className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--sf-700)] font-bold">
                    {formatPrice(p.offerPercent ? p.offerPrice : p.price, currency)}
                  </span>
                  {p.offerPercent ? (
                    <>
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(p.price, currency)}
                      </span>
                      <span className="text-[11px] bg-rose-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                        -{p.offerPercent}%
                      </span>
                    </>
                  ) : (
                    p.compareAtPrice && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(p.compareAtPrice, currency)}
                      </span>
                    )
                  )}
                </div>
                {p.trackStock && p.stock <= 3 && p.stock > 0 && (
                  <div className="text-xs text-amber-600 mt-1">تبقى {p.stock} فقط!</div>
                )}
                {p.trackStock && p.stock === 0 && (
                  <div className="text-xs text-red-500 mt-1">نفدت الكمية</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
