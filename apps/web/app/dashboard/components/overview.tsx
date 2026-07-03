"use client";

import { useEffect, useState } from "react";
import { ORDER_STATUS_AR, OrderStatus } from "@moeen/shared";
import { api, formatPrice } from "@/lib/api";

/** نظرة عامة — أرقام كبيرة واضحة، لا رسوم معقدة (القسم 11.1) */
export function Overview({ token, store }: { token: string; store: any }) {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/stores/${store.id}/stats`, { token })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [token, store.id]);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!stats) return <div className="text-gray-500">جارٍ التحميل...</div>;

  const cards = [
    { label: "اليوم", ...stats.today },
    { label: "آخر 7 أيام", ...stats.week },
    { label: "هذا الشهر", ...stats.month },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-5">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-3xl font-bold text-brand-700 mt-1">
              {formatPrice(c.revenue, store.currency)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {c.orders} {c.orders === 1 ? "طلب" : "طلبات"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-3">الطلبات حسب الحالة</h3>
          {Object.keys(stats.byStatus).length === 0 ? (
            <p className="text-gray-500 text-sm">لا طلبات بعد</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byStatus).map(([s, n]) => (
                <div key={s} className="flex justify-between text-sm">
                  <span>{ORDER_STATUS_AR[s as OrderStatus]}</span>
                  <span className="font-bold">{n as number}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-3">الأكثر مبيعاً 🏆</h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">لا مبيعات بعد</p>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p: any, i: number) => (
                <div key={p.name} className="flex justify-between text-sm">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-bold shrink-0 mr-2">{p.sold} قطعة</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-brand-900">
        💡 شارك رابط متجرك في حالة الواتساب وبايو إنستجرام:{" "}
        <span className="font-mono font-bold" dir="ltr">
          /s/{store.slug}
        </span>
      </div>
    </div>
  );
}
