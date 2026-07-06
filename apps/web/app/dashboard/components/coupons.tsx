"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatPrice } from "@/lib/api";

/** الكوبونات (القسم 9.1) — أداة "المندوبات" والمسوّقين */
export function Coupons({ token, store }: { token: string; store: any }) {
  const [coupons, setCoupons] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT" as "PERCENT" | "FIXED",
    value: "",
    minOrder: "",
    maxUses: "",
    expiresAt: "",
  });

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/coupons`, { token })
      .then(setCoupons)
      .catch((e) => setError(e.message));
  }, [token, store.id]);

  useEffect(load, [load]);

  async function create() {
    if (!form.code || !form.value) {
      setError("الكود وقيمة الخصم مطلوبان");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/stores/${store.id}/coupons`, {
        method: "POST",
        token,
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: Number(form.value),
          minOrder: form.minOrder ? Number(form.minOrder) : undefined,
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        }),
      });
      setForm({ code: "", type: "PERCENT", value: "", minOrder: "", maxUses: "", expiresAt: "" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string) {
    await api(`/stores/${store.id}/coupons/${id}/toggle`, { method: "PATCH", token });
    load();
  }

  if (!coupons) return <div className="text-gray-500">جارٍ التحميل...</div>;

  return (
    <div>
      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700"
      >
        {showForm ? "إغلاق" : "+ كوبون جديد"}
      </button>

      {showForm && (
        <div className="card border-2 border-brand-500 p-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded-lg px-3 py-2.5 w-full font-mono"
              placeholder="الكود (مثال: EID25) *"
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
            <select
              className="border rounded-lg px-3 py-2.5 w-full bg-white"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              <option value="PERCENT">نسبة %</option>
              <option value="FIXED">مبلغ ثابت</option>
            </select>
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder={form.type === "PERCENT" ? "النسبة (مثال: 10) *" : "المبلغ *"}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder="حد أدنى للطلب (اختياري)"
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            />
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder="عدد الاستخدامات (اختياري)"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <input
              type="date"
              className="border rounded-lg px-3 py-2.5 w-full"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="w-full bg-brand-600 text-white rounded-xl py-2.5 font-bold hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "جارٍ الحفظ..." : "إنشاء الكوبون ✓"}
          </button>
        </div>
      )}

      {error && <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="mt-4 space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="card p-3 flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-lg bg-purple-50 text-purple-700 rounded-lg px-3 py-1">🎟️ {c.code}</span>
            <span className="text-sm">
              {c.type === "PERCENT" ? `خصم ${Number(c.value)}%` : `خصم ${formatPrice(c.value, store.currency)}`}
              {c.minOrder && ` · حد أدنى ${formatPrice(c.minOrder, store.currency)}`}
            </span>
            <span className="text-sm text-gray-500">
              استُخدم {c.usedCount}
              {c.maxUses ? ` / ${c.maxUses}` : ""}
            </span>
            {c.expiresAt && (
              <span className="text-xs text-gray-400" dir="ltr">
                حتى {new Date(c.expiresAt).toLocaleDateString("ar-YE")}
              </span>
            )}
            <button
              onClick={() => toggle(c.id)}
              className={`text-xs rounded-lg px-3 py-1.5 font-semibold mr-auto ${
                c.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              }`}
            >
              {c.active ? "مفعّل ✓" : "موقوف"}
            </button>
          </div>
        ))}
        {coupons.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-10">
            أنشئ كوبوناً وشاركه مع المسوّقات في واتساب وإنستجرام — وتتبّع مبيعات كل كود 🎯
          </div>
        )}
      </div>
    </div>
  );
}
