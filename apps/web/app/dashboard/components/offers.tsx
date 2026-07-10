"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

/** العروض التلقائية (القسم 9.3): خصم يسري فوراً بلا كوبون — كل المتجر أو تصنيف */
export function Offers({ token, store }: { token: string; store: any }) {
  const [offers, setOffers] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", percent: "", categoryId: "", endsAt: "" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/offers`, { token }).then(setOffers).catch((e) => setError(e.message));
    api<any[]>(`/stores/${store.id}/categories`, { token }).then(setCategories).catch(() => {});
  }, [token, store.id]);

  useEffect(load, [load]);

  async function create() {
    if (!form.title || !form.percent) {
      setError("اسم العرض ونسبة الخصم مطلوبان");
      return;
    }
    setError("");
    try {
      await api(`/stores/${store.id}/offers`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: form.title,
          percent: Number(form.percent),
          categoryId: form.categoryId || undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        }),
      });
      setForm({ title: "", percent: "", categoryId: "", endsAt: "" });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggle(o: any) {
    await api(`/stores/${store.id}/offers/${o.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ active: !o.active }),
    });
    load();
  }

  async function remove(id: string) {
    await api(`/stores/${store.id}/offers/${id}`, { method: "DELETE", token });
    load();
  }

  const expired = (o: any) => o.endsAt && new Date(o.endsAt) < new Date();

  return (
    <div className="card p-4 mt-4">
      <h3 className="font-bold flex items-center gap-2">
        <BadgePercent size={17} className="text-brand-600" /> العروض التلقائية
      </h3>
      <p className="text-xs text-gray-500 mt-1 mb-3">
        خصم بنسبة يظهر فوراً على المنتجات بلا كوبون — على كل المتجر أو تصنيف واحد،
        والسعر المخفَّض يظهر للزوار مع شارة الخصم
      </p>

      <div className="grid md:grid-cols-5 gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
          placeholder="اسم العرض (مثال: تخفيضات العيد)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="number"
          min={1}
          max={90}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="الخصم % (1-90)"
          value={form.percent}
          onChange={(e) => setForm({ ...form, percent: e.target.value })}
        />
        <select
          className="border rounded-lg px-2 py-2 text-sm bg-white"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          <option value="">كل المتجر</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              تصنيف: {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="border rounded-lg px-2 py-2 text-sm"
          title="ينتهي في (اختياري)"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
        />
      </div>
      <button
        onClick={create}
        className="mt-2 bg-brand-600 text-white rounded-xl px-5 py-2 text-sm font-bold hover:bg-brand-700"
      >
        + أطلق العرض
      </button>
      {error && <div className="mt-2 bg-red-50 text-red-700 rounded-lg p-2.5 text-sm">{error}</div>}

      <div className="mt-4 space-y-2">
        {offers?.map((o) => (
          <div key={o.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm flex-wrap">
            <span className="bg-rose-500 text-white rounded-full px-2 py-0.5 text-xs font-bold shrink-0">
              -{o.percent}%
            </span>
            <span className="font-semibold">{o.title}</span>
            <span className="text-xs text-gray-500">
              {o.category ? `تصنيف ${o.category.name}` : "كل المتجر"}
              {o.endsAt && ` · حتى ${new Date(o.endsAt).toLocaleDateString("en-GB")}`}
            </span>
            {expired(o) ? (
              <span className="text-xs text-gray-400 font-bold">منتهٍ</span>
            ) : (
              <button
                onClick={() => toggle(o)}
                className={`text-xs rounded-full px-2.5 py-0.5 font-bold ${
                  o.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                }`}
              >
                {o.active ? "فعّال — أوقفه" : "موقوف — فعّله"}
              </button>
            )}
            <button
              onClick={() => remove(o.id)}
              className="mr-auto text-gray-400 hover:text-red-500 p-1"
              title="حذف العرض"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {offers?.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">لا عروض بعد — أطلق أول عرض لمتجرك 🎉</p>
        )}
      </div>
    </div>
  );
}
