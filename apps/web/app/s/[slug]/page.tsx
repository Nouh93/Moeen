import Link from "next/link";
import { notFound } from "next/navigation";
import { api, formatPrice } from "@/lib/api";
import { CartLink } from "./cart-widgets";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let store: any;
  try {
    store = await api(`/public/stores/${encodeURIComponent(slug)}`);
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <header className="bg-brand-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{store.name}</h1>
            {store.description && (
              <p className="text-brand-100 text-sm mt-1">{store.description}</p>
            )}
            <p className="text-brand-100 text-xs mt-1">
              {store.governorate?.nameAr}
              {store.city ? ` — ${store.city}` : ""}
            </p>
          </div>
          <CartLink slug={slug} />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {store.products.length === 0 ? (
          <p className="text-center text-gray-500 py-20">
            لا توجد منتجات معروضة حالياً
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {store.products.map((p: any) => (
              <Link
                key={p.id}
                href={`/s/${slug}/p/${p.id}`}
                className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center text-5xl">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    "🛍️"
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm leading-snug line-clamp-2">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-brand-700 font-bold">
                      {formatPrice(p.price, store.currency)}
                    </span>
                    {p.compareAtPrice && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(p.compareAtPrice, store.currency)}
                      </span>
                    )}
                  </div>
                  {p.trackStock && p.stock <= 3 && p.stock > 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                      تبقى {p.stock} فقط!
                    </div>
                  )}
                  {p.trackStock && p.stock === 0 && (
                    <div className="text-xs text-red-500 mt-1">نفدت الكمية</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {store.whatsapp && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            className="fixed bottom-5 left-5 bg-green-500 text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg hover:bg-green-600"
            title="تواصل مع التاجر عبر واتساب"
          >
            💬
          </a>
        )}
      </div>
    </main>
  );
}
