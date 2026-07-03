"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api, formatPrice } from "@/lib/api";
import { CartItem, clearCart, getCart, saveCart } from "@/lib/cart";

interface Governorate {
  id: number;
  nameAr: string;
  districts: { id: number; nameAr: string }[];
}

/**
 * إتمام الطلب في صفحة واحدة (القسم 6.3):
 * السلة + الاسم + الجوال + العنوان اليمني + الدفع عند الاستلام.
 * لو انقطع الإنترنت لحظة التأكيد: الطلب يُحفظ محلياً ويُرسَل تلقائياً
 * عند عودة الاتصال بنفس مفتاح idempotency — لا تكرار (القسم 22.1.2 بالملحق).
 */
export default function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [items, setItems] = useState<CartItem[]>([]);
  const [store, setStore] = useState<any>(null);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    governorateId: 0,
    districtId: 0,
    districtText: "",
    neighborhood: "",
    addressDetails: "",
    courierNote: "",
  });
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "submitting" }
    | { phase: "queued" }
    | { phase: "done"; code: string }
    | { phase: "error"; message: string }
  >({ phase: "idle" });

  // مفتاح idempotency ثابت لهذه السلة حتى نجاح الإرسال
  const idempotencyKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    const k = `moeen-idem-${slug}`;
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  }, [slug]);

  useEffect(() => {
    setItems(getCart(slug));
    api(`/public/stores/${encodeURIComponent(slug)}`).then(setStore).catch(() => {});
    api<Governorate[]>(`/public/yemen/governorates`).then(setGovernorates).catch(() => {});
  }, [slug]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = store ? Number(store.shippingFee) : 0;
  const selectedGov = governorates.find((g) => g.id === form.governorateId);

  function setQty(productId: string, qty: number) {
    const next = items
      .map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
      .filter((i) => i.quantity > 0);
    setItems(next);
    saveCart(slug, next);
  }

  async function submit(fromRetry = false) {
    if (!fromRetry) {
      if (!form.customerName || !form.customerPhone || !form.governorateId || !form.neighborhood || !form.addressDetails) {
        setState({ phase: "error", message: "أكمل كل الحقول الإلزامية (الاسم، الجوال، العنوان)" });
        return;
      }
    }
    setState({ phase: "submitting" });
    const payload = {
      ...form,
      governorateId: Number(form.governorateId),
      districtId: form.districtId ? Number(form.districtId) : undefined,
      districtText: form.districtText || undefined,
      courierNote: form.courierNote || undefined,
      idempotencyKey,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };
    try {
      const res = await api<{ order: { code: string } }>(
        `/public/stores/${encodeURIComponent(slug)}/orders`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      clearCart(slug);
      localStorage.removeItem(`moeen-idem-${slug}`);
      localStorage.removeItem(`moeen-pending-${slug}`);
      setState({ phase: "done", code: res.order.code });
    } catch (e: any) {
      // فشل شبكة (لا استجابة من السيرفر) → طابور محلي وإرسال تلقائي عند عودة الاتصال
      if (e instanceof TypeError || !navigator.onLine) {
        localStorage.setItem(`moeen-pending-${slug}`, JSON.stringify(payload));
        setState({ phase: "queued" });
      } else {
        setState({ phase: "error", message: e.message });
      }
    }
  }

  // إعادة الإرسال التلقائي عند عودة الاتصال
  useEffect(() => {
    const retry = () => {
      if (localStorage.getItem(`moeen-pending-${slug}`)) submit(true);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, items, form]);

  if (state.phase === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold mt-4">وصل طلبك بنجاح!</h1>
          <p className="text-gray-600 mt-2">
            سيتواصل معك المتجر لتأكيد الطلب. رمز التتبع:
          </p>
          <div className="mt-3 bg-brand-50 text-brand-700 font-mono text-2xl font-bold rounded-xl py-3">
            {state.code}
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={`/track/${state.code}`}
              className="bg-brand-600 text-white rounded-xl py-3 font-bold hover:bg-brand-700"
            >
              تتبّع طلبك
            </Link>
            <Link href={`/s/${slug}`} className="text-brand-600 py-2">
              العودة للمتجر
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href={`/s/${slug}`} className="font-bold text-lg">
            → {store?.name ?? "المتجر"}
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">🛒 سلتك وإتمام الطلب</h1>

        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            سلتك فارغة —{" "}
            <Link href={`/s/${slug}`} className="text-brand-600 underline">
              تصفح المنتجات
            </Link>
          </p>
        ) : (
          <>
            <div className="bg-white rounded-xl border divide-y">
              {items.map((i) => (
                <div key={i.productId} className="flex items-center gap-3 p-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
                    {i.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      "🛍️"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{i.name}</div>
                    <div className="text-brand-700 font-bold text-sm">
                      {store && formatPrice(i.price, store.currency)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(i.productId, i.quantity - 1)} className="w-8 h-8 rounded-lg border font-bold">−</button>
                    <span className="w-6 text-center font-bold">{i.quantity}</span>
                    <button onClick={() => setQty(i.productId, i.quantity + 1)} className="w-8 h-8 rounded-lg border font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border mt-4 p-4 space-y-3">
              <h2 className="font-bold text-lg">بيانات التوصيل</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  className="border rounded-lg px-3 py-2.5 w-full"
                  placeholder="الاسم الكامل *"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2.5 w-full"
                  placeholder="رقم الجوال (مثال: 771234567) *"
                  inputMode="tel"
                  dir="ltr"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                />
                <select
                  className="border rounded-lg px-3 py-2.5 w-full bg-white"
                  value={form.governorateId}
                  onChange={(e) => setForm({ ...form, governorateId: Number(e.target.value), districtId: 0 })}
                >
                  <option value={0}>المحافظة *</option>
                  {governorates.map((g) => (
                    <option key={g.id} value={g.id}>{g.nameAr}</option>
                  ))}
                </select>
                {selectedGov && selectedGov.districts.length > 0 ? (
                  <select
                    className="border rounded-lg px-3 py-2.5 w-full bg-white"
                    value={form.districtId}
                    onChange={(e) => setForm({ ...form, districtId: Number(e.target.value) })}
                  >
                    <option value={0}>المديرية</option>
                    {selectedGov.districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.nameAr}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="border rounded-lg px-3 py-2.5 w-full"
                    placeholder="المديرية"
                    value={form.districtText}
                    onChange={(e) => setForm({ ...form, districtText: e.target.value })}
                  />
                )}
              </div>
              <input
                className="border rounded-lg px-3 py-2.5 w-full"
                placeholder="الحي / العزلة / المنطقة *"
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              />
              <textarea
                className="border rounded-lg px-3 py-2.5 w-full"
                rows={2}
                placeholder="وصف تفصيلي للموقع * — مثال: بجانب مسجد الفاروق، عمارة بيضاء، الدور الثاني"
                value={form.addressDetails}
                onChange={(e) => setForm({ ...form, addressDetails: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2.5 w-full"
                placeholder="ملاحظة للمندوب (اختياري) — مثال: اتصل قبل الوصول"
                value={form.courierNote}
                onChange={(e) => setForm({ ...form, courierNote: e.target.value })}
              />
            </div>

            <div className="bg-white rounded-xl border mt-4 p-4">
              <div className="flex justify-between text-sm">
                <span>المجموع</span>
                <span className="font-semibold">{store && formatPrice(subtotal, store.currency)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>التوصيل</span>
                <span className="font-semibold">{store && formatPrice(shipping, store.currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
                <span>الإجمالي — تدفعه عند الاستلام 💵</span>
                <span className="text-brand-700">{store && formatPrice(subtotal + shipping, store.currency)}</span>
              </div>
            </div>

            {state.phase === "error" && (
              <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{state.message}</div>
            )}
            {state.phase === "queued" && (
              <div className="mt-3 bg-amber-50 text-amber-800 rounded-lg p-3 text-sm">
                ⚠️ لا يوجد اتصال حالياً — حفظنا طلبك وسيُرسَل تلقائياً فور عودة الإنترنت. اترك هذه الصفحة مفتوحة.
              </div>
            )}

            <button
              onClick={() => submit()}
              disabled={state.phase === "submitting"}
              className="mt-4 w-full bg-brand-600 text-white rounded-xl py-4 text-lg font-bold hover:bg-brand-700 disabled:opacity-60"
            >
              {state.phase === "submitting" ? "جارٍ إرسال طلبك..." : "تأكيد الطلب ✓"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
