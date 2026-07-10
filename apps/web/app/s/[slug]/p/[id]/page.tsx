import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, imgUrl } from "@/lib/api";
import { CartLink } from "../../cart-widgets";
import { ProductView } from "./product-view";

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
      description:
        product.seoDescription ??
        product.description ??
        `اطلب ${product.name} من ${store.name} — الدفع عند الاستلام`,
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
      <ProductView slug={slug} store={store} product={product} />
    </main>
  );
}
