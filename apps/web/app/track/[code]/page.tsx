import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUS_AR, OrderStatus } from "@moeen/shared";
import { api, formatPrice } from "@/lib/api";

const STATUS_FLOW: OrderStatus[] = ["NEW", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"];
const STATUS_ICON: Record<string, string> = {
  NEW: "📥",
  PROCESSING: "📦",
  OUT_FOR_DELIVERY: "🛵",
  DELIVERED: "✅",
  CANCELLED: "❌",
  RETURNED: "↩️",
};

/** صفحة تتبع عامة — تعمل برمز الطلب فقط، بدون تسجيل دخول (القسم 6.3) */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let order: any;
  try {
    order = await api(`/public/orders/track/${encodeURIComponent(code)}`);
  } catch {
    notFound();
  }

  const currentIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border p-6">
          <div className="text-center">
            <div className="text-5xl">{STATUS_ICON[order.status] ?? "📦"}</div>
            <h1 className="text-xl font-bold mt-2">
              {ORDER_STATUS_AR[order.status as OrderStatus]}
            </h1>
            <div className="text-gray-500 text-sm mt-1 font-mono">{order.code}</div>
            <div className="text-sm mt-1">
              من{" "}
              <Link href={`/s/${order.store.slug}`} className="text-brand-600 font-semibold">
                {order.store.name}
              </Link>
            </div>
          </div>

          {currentIdx >= 0 && (
            <div className="flex items-center mt-6" dir="rtl">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <div
                      className={`absolute top-3 right-1/2 w-full h-1 -z-0 ${i <= currentIdx ? "bg-brand-500" : "bg-gray-200"}`}
                    />
                  )}
                  <div
                    className={`w-7 h-7 rounded-full z-10 flex items-center justify-center text-xs font-bold ${
                      i <= currentIdx ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="text-[10px] mt-1 text-center leading-tight">
                    {ORDER_STATUS_AR[s].split(" — ")[0]}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <h2 className="font-bold text-sm text-gray-500 mb-2">المنتجات</h2>
            {order.items.map((i: any) => (
              <div key={i.id} className="flex justify-between text-sm py-1">
                <span>{i.name} × {i.quantity}</span>
                <span className="font-semibold">{formatPrice(Number(i.price) * i.quantity, order.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>الإجمالي (عند الاستلام 💵)</span>
              <span className="text-brand-700">{formatPrice(order.total, order.currency)}</span>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 text-sm text-gray-600">
            <div>📍 {order.governorate.nameAr}{order.district ? ` — ${order.district.nameAr}` : ""} — {order.neighborhood}</div>
            <div className="mt-1">{order.addressDetails}</div>
          </div>

          <div className="mt-4 border-t pt-4">
            <h2 className="font-bold text-sm text-gray-500 mb-2">سجل الطلب</h2>
            {order.events.map((e: any) => (
              <div key={e.id} className="flex gap-2 text-sm py-1">
                <span>{STATUS_ICON[e.status]}</span>
                <span className="flex-1">
                  {ORDER_STATUS_AR[e.status as OrderStatus]}
                  {e.note ? ` — ${e.note}` : ""}
                </span>
                <span className="text-gray-400 text-xs" dir="ltr">
                  {new Date(e.createdAt).toLocaleString("ar-YE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>

          {order.store.whatsapp && (
            <a
              href={`https://wa.me/${order.store.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`استفسار عن طلبي ${order.code}`)}`}
              target="_blank"
              className="mt-5 block bg-green-500 text-white text-center rounded-xl py-3 font-bold hover:bg-green-600"
            >
              تواصل مع المتجر عبر واتساب 💬
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
