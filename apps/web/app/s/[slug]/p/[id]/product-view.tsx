"use client";

import { useState } from "react";
import { Banknote, Check, ImageIcon, MessageCircle, ShoppingCart, Zap } from "lucide-react";
import { formatPrice, imgUrl } from "@/lib/api";
import { addToCart } from "@/lib/cart";

/** عرض المنتج: معرض صور + خيارات (مقاس/لون) + إضافة للسلة (القسم 5.1) */
export function ProductView({
  slug,
  store,
  product,
}: {
  slug: string;
  store: any;
  product: any;
}) {
  const gallery: string[] = [product.imageUrl, ...(product.images ?? [])].filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  const variants: any[] = product.variants ?? [];
  const [variantId, setVariantId] = useState<string>(variants[0]?.id ?? "");
  const variant = variants.find((v) => v.id === variantId);
  const [added, setAdded] = useState(false);

  const basePrice = variant?.price ?? product.price;
  const offerPercent: number = product.offerPercent ?? 0;
  // السعر المعروض بعد العرض التلقائي — الخادم يعيد الحساب عند إنشاء الطلب
  const price = offerPercent ? Number(basePrice) * (1 - offerPercent / 100) : basePrice;
  const outOfStock = variant
    ? variant.stock === 0
    : product.trackStock && product.stock === 0;
  const lowStock = variant
    ? variant.stock > 0 && variant.stock <= 5 && variant.stock
    : product.trackStock && product.stock > 0 && product.stock <= 5 && product.stock;

  function add() {
    addToCart(
      slug,
      {
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        price: Number(price),
        imageUrl: gallery[0],
      },
      product.minQty ?? 1, // أول إضافة تبدأ من أقل كمية للطلب
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
      <div>
        <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
          {gallery.length ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(gallery[activeImage])}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon size={64} className="text-gray-200" strokeWidth={1} />
          )}
        </div>
        {gallery.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {gallery.map((url, i) => (
              <button
                key={url}
                onClick={() => setActiveImage(i)}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                  i === activeImage ? "border-[var(--sf-600)]" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(url)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl font-bold text-[var(--sf-700)]">
            {formatPrice(price, store.currency)}
          </span>
          {offerPercent > 0 && (
            <>
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(basePrice, store.currency)}
              </span>
              <span className="text-xs bg-rose-500 text-white rounded-full px-2 py-1 font-bold">
                خصم {offerPercent}%{product.offerTitle ? ` — ${product.offerTitle}` : ""}
              </span>
            </>
          )}
          {!offerPercent && product.compareAtPrice && !variant?.price && (
            <span className="text-lg text-gray-400 line-through">
              {formatPrice(product.compareAtPrice, store.currency)}
            </span>
          )}
        </div>

        {variants.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">اختر:</div>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  disabled={v.stock === 0}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold border-2 ${
                    v.id === variantId
                      ? "border-[var(--sf-600)] bg-[color-mix(in_srgb,var(--sf-600)_8%,white)] text-[var(--sf-800)]"
                      : "border-gray-200 bg-white hover:border-[color-mix(in_srgb,var(--sf-600)_45%,white)]"
                  } disabled:opacity-40 disabled:line-through`}
                >
                  {v.name}
                  {v.price && (
                    <span className="text-xs text-gray-500 mr-1">
                      {formatPrice(v.price, store.currency)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {lowStock ? (
          <div className="mt-3 text-amber-600 font-semibold text-sm flex items-center gap-1">
            <Zap size={15} /> تبقى {lowStock} قطع فقط
          </div>
        ) : null}

        {product.description && (
          <p className="mt-4 text-gray-700 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        )}

        {(product.brand || (product.tags?.length ?? 0) > 0 || product.sku || (product.minQty ?? 1) > 1 || product.maxQty) && (
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            {product.brand && (
              <div>
                الماركة: <span className="font-semibold text-gray-800">{product.brand}</span>
              </div>
            )}
            {(product.minQty ?? 1) > 1 && <div>أقل كمية للطلب: {product.minQty}</div>}
            {product.maxQty && <div>أقصى كمية لكل طلب: {product.maxQty}</div>}
            {product.sku && (
              <div className="text-xs text-gray-400" dir="ltr">SKU: {product.sku}</div>
            )}
            {(product.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t: string) => (
                  <span key={t} className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            disabled={outOfStock}
            onClick={add}
            className="flex-1 bg-[var(--sf-600)] text-white rounded-xl py-3 font-bold text-lg hover:bg-[var(--sf-700)] disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {outOfStock ? (
              "نفدت الكمية"
            ) : added ? (
              <span className="inline-flex items-center gap-2">
                <Check size={20} /> أُضيف للسلة
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <ShoppingCart size={20} /> أضف للسلة
              </span>
            )}
          </button>
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`استفسار عن: ${product.name}`)}`}
              target="_blank"
              className="bg-green-500 text-white rounded-xl px-5 py-3 font-bold hover:bg-green-600 inline-flex items-center gap-2"
            >
              <MessageCircle size={20} /> واتساب
            </a>
          )}
        </div>
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-1.5">
          <Banknote size={16} className="text-green-600" /> الدفع عند الاستلام — رسوم التوصيل{" "}
          {formatPrice(store.shippingFee, store.currency)}
        </p>
      </div>
    </div>
  );
}
