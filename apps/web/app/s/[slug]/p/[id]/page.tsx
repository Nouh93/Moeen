import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, ImageIcon, MessageCircle, Zap } from "lucide-react";
import { api, formatPrice, imgUrl } from "@/lib/api";
import { AddToCartButton, CartLink } from "../../cart-widgets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  try {
    const store = await api(`/public/stores/${encodeURIComponent(slug)}`);
    const product = store.products.find((p: any) => p.id === id);
    if (!product) return { title: store.name };
    return {
      title: `${product.name} — ${store.name}`,
      description: product.description ?? `اطلب ${product.name} من ${store.name} — الدفع عند الاستلام`,
      openGraph: {
        title: product.name,
        ...(product.imageUrl ? { images: [imgUrl(product.imageUrl)!] } : {}),
      },
    };
  } catch {
    return { title: "مُعين" };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  let store: any;
  try {
    store = await api(`/public/stores/${encodeURIComponent(slug)}`);
  } catch {
    notFound();
  }
  const product = store.products.find((p: any) => p.id === id);
  if (!product) notFound();

  const outOfStock = product.trackStock && product.stock === 0;

  return (
    <main className="min-h-screen">
      <header className="brand-header text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/s/${slug}`} className="font-bold text-lg">
            → {store.name}
          </Link>
          <CartLink slug={slug} />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-8xl overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(product.imageUrl)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon size={64} className="text-gray-200" strokeWidth={1} />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl font-bold text-brand-700">
              {formatPrice(product.price, store.currency)}
            </span>
            {product.compareAtPrice && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(product.compareAtPrice, store.currency)}
              </span>
            )}
          </div>
          {product.trackStock && product.stock > 0 && product.stock <= 5 && (
            <div className="mt-2 text-amber-600 font-semibold text-sm flex items-center gap-1">
              <Zap size={15} /> تبقى {product.stock} قطع فقط
            </div>
          )}
          {product.description && (
            <p className="mt-4 text-gray-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <AddToCartButton
              slug={slug}
              product={product}
              disabled={outOfStock}
            />
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
    </main>
  );
}
