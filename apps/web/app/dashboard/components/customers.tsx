"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, Users } from "lucide-react";
import { api, formatPrice } from "@/lib/api";

/** عملاء المتجر (القسم 11.3): مُجمَّعون من الطلبات، الأعلى إنفاقاً أولاً */
export function Customers({ token, store }: { token: string; store: any }) {
  const [customers, setCustomers] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setCustomers(null);
    api<any[]>(`/stores/${store.id}/customers`, { token })
      .then(setCustomers)
      .catch((e) => setError(e.message));
  }, [token, store.id]);

  const visible = useMemo(() => {
    if (!customers) return null;
    const nq = q.trim();
    if (!nq) return customers;
    return customers.filter((c) => c.name.includes(nq) || c.phone.includes(nq.replace(/^0/, "")));
  }, [customers, q]);

  if (error) return <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>;
  if (!visible) return <p className="text-gray-500 py-10 text-center">جارٍ التحميل...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Users size={19} className="text-brand-600" /> عملاؤك
          <span className="text-sm text-gray-500 font-normal">
            ({customers!.length.toLocaleString("ar-u-nu-latn")})
          </span>
        </h2>
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="border rounded-full pr-8 pl-4 py-1.5 text-sm w-full bg-white"
            placeholder="ابحث بالاسم أو الرقم..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-gray-500 py-16">
          {q ? "لا نتائج مطابقة" : "لا عملاء بعد — أول طلب يصلك سيظهر صاحبه هنا"}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <div key={c.phone} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                {c.name.trim().charAt(0) || "؟"}
              </div>
              <div className="flex-1 min-w-40">
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-gray-500 font-mono" dir="ltr">{c.phone}</div>
              </div>
              <div className="text-center px-2">
                <div className="font-bold text-sm">{c.orders.toLocaleString("ar-u-nu-latn")}</div>
                <div className="text-[11px] text-gray-500">طلبات</div>
              </div>
              <div className="text-center px-2">
                <div className="font-bold text-sm text-green-700">{c.delivered.toLocaleString("ar-u-nu-latn")}</div>
                <div className="text-[11px] text-gray-500">مُسلَّمة</div>
              </div>
              <div className="text-center px-2 min-w-24">
                <div className="font-bold text-sm text-brand-700">{formatPrice(c.spent, store.currency)}</div>
                <div className="text-[11px] text-gray-500">إجمالي الشراء</div>
              </div>
              <div className="text-center px-2">
                <div className="text-xs text-gray-600" dir="ltr">
                  {new Date(c.lastOrderAt).toLocaleDateString("en-GB")}
                </div>
                <div className="text-[11px] text-gray-500">آخر طلب</div>
              </div>
              <a
                href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shrink-0"
                title="راسل العميل على واتساب"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
