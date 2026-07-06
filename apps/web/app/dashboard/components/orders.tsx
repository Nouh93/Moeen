"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ORDER_STATUS_AR,
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
} from "@moeen/shared";
import { api, formatPrice } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  RETURNED: "bg-red-100 text-red-700",
};

const ACTION_LABEL: Record<string, string> = {
  PROCESSING: "ابدأ التجهيز 📦",
  OUT_FOR_DELIVERY: "سلّمته للمندوب 🛵",
  DELIVERED: "تم التسليم ✅",
  CANCELLED: "إلغاء",
  RETURNED: "مرتجع ↩️",
};

const FILTERS: { id: string; label: string }[] = [
  { id: "", label: "الكل" },
  { id: "NEW", label: "جديدة" },
  { id: "PROCESSING", label: "قيد التجهيز" },
  { id: "OUT_FOR_DELIVERY", label: "مع المندوب" },
  { id: "DELIVERED", label: "مسلّمة" },
  { id: "CANCELLED", label: "ملغاة" },
];

export function Orders({ token, store }: { token: string; store: any }) {
  const [data, setData] = useState<{ orders: any[]; count: number; page: number; pages: number } | null>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (q) params.set("q", q);
    params.set("page", String(page));
    api(`/stores/${store.id}/orders?${params}`, { token })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, store.id, filter, q, page]);

  useEffect(load, [load]);

  async function setStatus(orderId: string, status: string) {
    try {
      await api(`/stores/${store.id}/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === f.id ? "bg-brand-600 text-white" : "bg-white border hover:bg-gray-100"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40"
          placeholder="🔍 بحث برمز الطلب أو اسم/جوال العميل"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <div className="mb-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {!data ? (
        <div className="text-gray-500">جارٍ التحميل...</div>
      ) : data.orders.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          {q || filter ? "لا نتائج مطابقة" : "لا توجد طلبات بعد — شارك رابط متجرك لتصلك الطلبات 🚀"}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.orders.map((o) => {
              const next = ORDER_STATUS_TRANSITIONS[o.status as OrderStatus] ?? [];
              return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold">{o.code}</span>
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS_BADGE[o.status]}`}>
                        {ORDER_STATUS_AR[o.status as OrderStatus]}
                      </span>
                      <span className="text-xs text-gray-400" dir="ltr">
                        {new Date(o.createdAt).toLocaleString("ar-YE", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <div className="text-brand-700 font-bold">{formatPrice(o.total, o.currency)} 💵</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <div>
                      👤 {o.customerName} —{" "}
                      <a
                        href={`https://wa.me/${o.customerPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        className="text-green-600 font-semibold"
                        dir="ltr"
                      >
                        {o.customerPhone} 💬
                      </a>
                    </div>
                    <div className="mt-1">
                      📍 {o.governorate?.nameAr}
                      {o.district ? ` — ${o.district.nameAr}` : o.districtText ? ` — ${o.districtText}` : ""} — {o.neighborhood}
                    </div>
                    <div className="text-gray-500">{o.addressDetails}</div>
                    {o.courierNote && <div className="text-amber-700 mt-1">📝 للمندوب: {o.courierNote}</div>}
                    {o.couponCode && (
                      <div className="text-purple-700 mt-1">
                        🎟️ كوبون {o.couponCode} — خصم {formatPrice(o.discount, o.currency)}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-sm border-t pt-2">
                    {o.items.map((i: any) => (
                      <span key={i.id} className="inline-block bg-gray-100 rounded-lg px-2 py-1 ml-1 mb-1">
                        {i.name} × {i.quantity}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {next.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(o.id, s)}
                        className={`rounded-lg px-4 py-2 text-sm font-bold ${
                          s === "CANCELLED" || s === "RETURNED"
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                        }`}
                      >
                        {ACTION_LABEL[s]}
                      </button>
                    ))}
                    <a
                      href={`/dashboard/waybill/${o.id}`}
                      target="_blank"
                      className="rounded-lg px-4 py-2 text-sm font-bold border hover:bg-gray-50"
                    >
                      بوليصة الشحن 🖨️
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="border rounded-lg px-4 py-2 text-sm disabled:opacity-40"
              >
                السابق
              </button>
              <span className="text-sm text-gray-600">
                صفحة {data.page} من {data.pages} ({data.count} طلب)
              </span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
                className="border rounded-lg px-4 py-2 text-sm disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
