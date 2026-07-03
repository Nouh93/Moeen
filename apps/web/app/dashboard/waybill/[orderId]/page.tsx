"use client";

import { use, useEffect, useState } from "react";
import { api, formatPrice } from "@/lib/api";

/**
 * بوليصة الشحن (القسم 8.3): العنوان اليمني بخط كبير، مبلغ COD بارز،
 * جوالا العميل والتاجر — تُطبع وتُرفق بالشحنة.
 */
export default function WaybillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("moeen-token");
    if (!token) {
      setError("سجّل دخولك أولاً من لوحة التحكم");
      return;
    }
    api<any[]>("/stores/mine", { token })
      .then((stores) =>
        api(`/stores/${stores[0].id}/orders/${orderId}`, { token }),
      )
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [orderId]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!order) return <div className="p-8 text-gray-500">جارٍ التحميل...</div>;

  return (
    <main className="min-h-screen bg-white p-6 max-w-2xl mx-auto print:p-2">
      <div className="border-2 border-gray-900 rounded-xl p-5">
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-3">
          <div>
            <div className="text-2xl font-bold">{order.store.name}</div>
            <div className="text-sm" dir="ltr">{order.store.whatsapp}</div>
          </div>
          <div className="text-left">
            <div className="font-mono text-2xl font-bold">{order.code}</div>
            <div className="text-xs text-gray-500" dir="ltr">
              {new Date(order.createdAt).toLocaleDateString("ar-YE")}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-bold">المستلم</div>
            <div className="text-xl font-bold mt-1">{order.customerName}</div>
            <div className="text-lg font-bold mt-1" dir="ltr">{order.customerPhone}</div>
          </div>
          <div className="bg-gray-900 text-white rounded-xl p-3 text-center">
            <div className="text-xs">المبلغ المطلوب تحصيله 💵</div>
            <div className="text-3xl font-bold mt-1">
              {formatPrice(order.total, order.currency)}
            </div>
            <div className="text-xs mt-1">الدفع عند الاستلام</div>
          </div>
        </div>

        <div className="mt-4 border-2 border-gray-300 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-bold">العنوان</div>
          <div className="text-2xl font-bold leading-relaxed mt-1">
            {order.governorate.nameAr}
            {order.district ? ` — ${order.district.nameAr}` : order.districtText ? ` — ${order.districtText}` : ""}
            {" — "}
            {order.neighborhood}
          </div>
          <div className="text-xl leading-relaxed mt-2">{order.addressDetails}</div>
          {order.courierNote && (
            <div className="text-lg font-bold mt-3 bg-amber-100 rounded-lg p-2">
              📝 ملاحظة: {order.courierNote}
            </div>
          )}
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900 text-right">
              <th className="py-1">المنتج</th>
              <th className="py-1 w-16 text-center">الكمية</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i: any) => (
              <tr key={i.id} className="border-b border-gray-200">
                <td className="py-1.5">{i.name}</td>
                <td className="py-1.5 text-center font-bold">{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 text-center text-xs text-gray-400">
          بوليصة صادرة من منصة مُعين 🇾🇪 — moeen.ye
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="mt-4 w-full bg-brand-600 text-white rounded-xl py-3 font-bold hover:bg-brand-700 print:hidden"
      >
        اطبع البوليصة 🖨️
      </button>
    </main>
  );
}
