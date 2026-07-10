import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Medal, MessageCircle, Star, Truck } from "lucide-react";
import { api, imgUrl } from "@/lib/api";
import { CartLink } from "./cart-widgets";
import { ProductsBrowser } from "./products-browser";

async function getStore(slug: string) {
  try {
    return await api(`/public/stores/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: "المتجر غير موجود — مُعين" };
  return {
    title: `${store.name} — مُعين`,
    description: store.description ?? `تسوّق من ${store.name} — الدفع عند الاستلام والتوصيل داخل اليمن`,
    openGraph: {
      title: store.name,
      description: store.description ?? "",
      ...(store.logoUrl ? { images: [imgUrl(store.logoUrl)!] } : {}),
    },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  return (
    <main className="min-h-screen">
      <header className="brand-header text-white">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl(store.logoUrl)}
                alt=""
                className="w-14 h-14 rounded-xl object-cover bg-white/10 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate flex items-center gap-2">
                {store.name}
                {store.badges?.trusted && (
                  <span className="text-xs bg-amber-400 text-brand-950 font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1 shrink-0">
                    <Medal size={13} /> متجر موثوق
                  </span>
                )}
                {!store.badges?.trusted && store.badges?.verified && (
                  <span className="text-xs bg-white/15 text-white font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1 shrink-0">
                    <BadgeCheck size={13} className="text-amber-300" /> هوية موثّقة
                  </span>
                )}
              </h1>
              {store.description && (
                <p className="text-brand-100 text-sm mt-1 line-clamp-1">{store.description}</p>
              )}
              <p className="text-brand-100 text-xs mt-1 flex items-center gap-2 flex-wrap">
                {store.rating?.count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} className="text-amber-300 fill-amber-300" />
                    {Number(store.rating.average).toFixed(1)} ({store.rating.count})
                  </span>
                )}
                {store.deliveredOrders > 0 && <span>أكمل {store.deliveredOrders} طلباً ·</span>}
                {store.governorate?.nameAr}
                {store.city ? ` — ${store.city}` : ""}
                {store.freeShippingAbove && (
                  <span className="inline-flex items-center gap-1 mr-1">
                    · <Truck size={12} /> توصيل مجاني فوق{" "}
                    {Number(store.freeShippingAbove).toLocaleString("ar-u-nu-latn")}
                  </span>
                )}
              </p>
            </div>
          </div>
          <CartLink slug={slug} />
        </div>
      </header>

      {store.coverUrl && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl(store.coverUrl)}
            alt=""
            className="w-full aspect-[3/1] object-cover rounded-2xl shadow-sm"
          />
        </div>
      )}

      {Array.isArray(store.banners) && store.banners.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [-webkit-overflow-scrolling:touch]">
            {store.banners.map((b: any, i: number) => {
              const img = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl(b.imageUrl)}
                  alt=""
                  loading="lazy"
                  className="h-36 md:h-44 rounded-xl object-cover snap-start shrink-0"
                />
              );
              return b.link ? (
                <a key={i} href={b.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {img}
                </a>
              ) : (
                <span key={i} className="shrink-0">{img}</span>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        <ProductsBrowser
          slug={slug}
          currency={store.currency}
          products={store.products}
          categories={store.categories ?? []}
        />

        {store.whatsapp && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            className="fixed bottom-5 left-5 bg-green-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-green-600"
            title="تواصل مع التاجر عبر واتساب"
          >
            <MessageCircle size={26} />
          </a>
        )}
      </div>
    </main>
  );
}
