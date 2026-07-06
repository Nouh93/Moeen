import { Metadata } from "next";
import { notFound } from "next/navigation";
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
              <h1 className="text-2xl font-bold truncate">{store.name}</h1>
              {store.description && (
                <p className="text-brand-100 text-sm mt-1 line-clamp-1">{store.description}</p>
              )}
              <p className="text-brand-100 text-xs mt-1">
                {store.governorate?.nameAr}
                {store.city ? ` — ${store.city}` : ""}
                {store.freeShippingAbove &&
                  ` · 🚚 توصيل مجاني فوق ${Number(store.freeShippingAbove).toLocaleString("ar-YE")}`}
              </p>
            </div>
          </div>
          <CartLink slug={slug} />
        </div>
      </header>

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
