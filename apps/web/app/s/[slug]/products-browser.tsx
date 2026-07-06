"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice, imgUrl } from "@/lib/api";

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
    if (category) list = list.filter((p) => p.categoryId === category);
    if (q.trim()) {
      const nq = normalize(q);
      list = list.filter(
        (p) =>
          normalize(p.name).includes(nq) ||
          (p.description && normalize(p.description).includes(nq)),
      );
    }
    return list;
  }, [products, category, q]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {categories.length > 0 && (
          <>
            <button
              onClick={() => setCategory("")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                !category ? "bg-brand-600 text-white" : "bg-white border hover:bg-gray-100"
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id === category ? "" : c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  category === c.id ? "bg-brand-600 text-white" : "bg-white border hover:bg-gray-100"
                }`}
              >
                {c.name}
              </button>
            ))}
          </>
        )}
        <input
          className="border rounded-full px-4 py-1.5 text-sm flex-1 min-w-40 bg-white"
          placeholder="🔍 ابحث في المتجر"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
              <div className="aspect-square bg-gray-100 flex items-center justify-center text-5xl">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(p.imageUrl)} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  "🛍️"
                )}
              </div>
              <div className="p-3">
                <div className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-brand-700 font-bold">{formatPrice(p.price, currency)}</span>
                  {p.compareAtPrice && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatPrice(p.compareAtPrice, currency)}
                    </span>
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
