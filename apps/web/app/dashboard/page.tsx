"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CURRENCY_AR,
  ORDER_STATUS_AR,
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
} from "@moeen/shared";
import { api, formatPrice } from "@/lib/api";

/** لوحة تحكم التاجر — تعمل كاملة من متصفح الجوال (القسم 12.1) */
export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("moeen-token"));
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) {
    return (
      <Login
        onLogin={(t) => {
          localStorage.setItem("moeen-token", t);
          setToken(t);
        }}
      />
    );
  }
  return (
    <Panel
      token={token}
      onLogout={() => {
        localStorage.removeItem("moeen-token");
        setToken(null);
      }}
    />
  );
}

// ---------- تسجيل الدخول برقم الجوال + OTP (القسم 4.1) ----------

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ devCode?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setDevCode(res.devCode ?? null);
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      onLogin(res.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border p-8 max-w-sm w-full">
        <Link href="/" className="block text-center text-2xl font-bold text-brand-700">
          مُعين 🇾🇪
        </Link>
        <h1 className="text-center text-lg font-semibold mt-2 text-gray-600">
          دخول التاجر
        </h1>
        {step === "phone" ? (
          <>
            <input
              className="border rounded-lg px-3 py-3 w-full mt-6"
              placeholder="رقم جوالك (مثال: 771234567)"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestOtp()}
            />
            <button
              onClick={requestOtp}
              disabled={busy}
              className="mt-4 w-full bg-brand-600 text-white rounded-xl py-3 font-bold hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "لحظات..." : "أرسل رمز التحقق"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mt-4 text-center">
              أدخل الرمز المُرسَل إلى جوالك
              {devCode && (
                <span className="block mt-1 text-amber-600">
                  (وضع التطوير — الرمز: <b className="font-mono">{devCode}</b>)
                </span>
              )}
            </p>
            <input
              className="border rounded-lg px-3 py-3 w-full mt-3 text-center font-mono text-xl tracking-widest"
              placeholder="······"
              inputMode="numeric"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button
              onClick={verify}
              disabled={busy}
              className="mt-4 w-full bg-brand-600 text-white rounded-xl py-3 font-bold hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "لحظات..." : "دخول"}
            </button>
          </>
        )}
        {error && (
          <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}
      </div>
    </main>
  );
}

// ---------- اللوحة ----------

function Panel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stores, setStores] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"orders" | "products" | "settings">("orders");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<any[]>("/stores/mine", { token })
      .then(setStores)
      .catch((e) => {
        if (e.message.includes("جلستك")) onLogout();
        else setError(e.message);
      });
  }, [token, onLogout]);

  useEffect(load, [load]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!stores) return <div className="p-8 text-gray-500">جارٍ التحميل...</div>;
  if (stores.length === 0) return <CreateStore token={token} onCreated={load} />;

  const store = stores[0];

  return (
    <main className="min-h-screen">
      <header className="bg-brand-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">{store.name}</div>
            <a
              href={`/s/${store.slug}`}
              target="_blank"
              className="text-brand-100 text-xs underline"
            >
              /s/{store.slug} — افتح متجرك ↗
            </a>
          </div>
          <button onClick={onLogout} className="text-sm bg-white/15 rounded-lg px-3 py-1.5 hover:bg-white/25">
            خروج
          </button>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1">
          {(
            [
              ["orders", "📦 الطلبات"],
              ["products", "🛍️ المنتجات"],
              ["settings", "⚙️ الإعدادات"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 rounded-t-lg text-sm font-semibold ${
                tab === id ? "bg-gray-50 text-brand-700" : "text-brand-100 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === "orders" && <Orders token={token} store={store} />}
        {tab === "products" && <Products token={token} store={store} />}
        {tab === "settings" && <Settings token={token} store={store} onSaved={load} />}
      </div>
    </main>
  );
}

// ---------- إنشاء متجر (3 دقائق — القسم 4.1) ----------

function CreateStore({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [governorates, setGovernorates] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    governorateId: 0,
    city: "",
    currency: "YER_SANAA",
    shippingFee: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any[]>("/public/yemen/governorates").then(setGovernorates).catch(() => {});
  }, []);

  async function create() {
    if (!form.name) {
      setError("اكتب اسم متجرك");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/stores", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          governorateId: form.governorateId || undefined,
          whatsapp: form.whatsapp || undefined,
          city: form.city || undefined,
          shippingFee: Number(form.shippingFee) || 0,
        }),
      });
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center">أنشئ متجرك 🎉</h1>
        <p className="text-gray-500 text-sm text-center mt-1">
          ثلاث خطوات ومتجرك يستقبل الطلبات
        </p>
        <div className="mt-6 space-y-3">
          <input
            className="border rounded-lg px-3 py-3 w-full"
            placeholder="اسم المتجر *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border rounded-lg px-3 py-3 w-full"
            placeholder="رقم واتساب المتجر (اختياري)"
            dir="ltr"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className="border rounded-lg px-3 py-3 w-full bg-white"
              value={form.governorateId}
              onChange={(e) => setForm({ ...form, governorateId: Number(e.target.value) })}
            >
              <option value={0}>المحافظة</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.id}>{g.nameAr}</option>
              ))}
            </select>
            <input
              className="border rounded-lg px-3 py-3 w-full"
              placeholder="المدينة"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <select
            className="border rounded-lg px-3 py-3 w-full bg-white"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {Object.entries(CURRENCY_AR).map(([k, v]) => (
              <option key={k} value={k}>عملة الأسعار: {v}</option>
            ))}
          </select>
          <label className="block text-sm text-gray-600">
            رسوم التوصيل الافتراضية
            <input
              type="number"
              className="border rounded-lg px-3 py-3 w-full mt-1"
              value={form.shippingFee}
              onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })}
            />
          </label>
        </div>
        {error && (
          <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}
        <button
          onClick={create}
          disabled={busy}
          className="mt-5 w-full bg-brand-600 text-white rounded-xl py-3 font-bold hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "جارٍ الإنشاء..." : "افتح متجري ✓"}
        </button>
      </div>
    </main>
  );
}

// ---------- الطلبات ----------

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

function Orders({ token, store }: { token: string; store: any }) {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/orders`, { token })
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, [token, store.id]);

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

  if (error) return <div className="text-red-600">{error}</div>;
  if (!orders) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (orders.length === 0) {
    return (
      <div className="text-center text-gray-500 py-16">
        لا توجد طلبات بعد — شارك رابط متجرك في واتساب وإنستجرام لتصلك الطلبات 🚀
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const next = ORDER_STATUS_TRANSITIONS[o.status as OrderStatus] ?? [];
        return (
          <div key={o.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{o.code}</span>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS_BADGE[o.status]}`}>
                  {ORDER_STATUS_AR[o.status as OrderStatus]}
                </span>
              </div>
              <div className="text-brand-700 font-bold">
                {formatPrice(o.total, o.currency)} 💵
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <div>
                👤 {o.customerName} —{" "}
                <a href={`https://wa.me/${o.customerPhone.replace(/\D/g, "")}`} target="_blank" className="text-green-600 font-semibold" dir="ltr">
                  {o.customerPhone} 💬
                </a>
              </div>
              <div className="mt-1">
                📍 {o.governorate?.nameAr}
                {o.district ? ` — ${o.district.nameAr}` : o.districtText ? ` — ${o.districtText}` : ""} — {o.neighborhood}
              </div>
              <div className="text-gray-500">{o.addressDetails}</div>
              {o.courierNote && <div className="text-amber-700 mt-1">📝 للمندوب: {o.courierNote}</div>}
            </div>
            <div className="mt-2 text-sm border-t pt-2">
              {o.items.map((i: any) => (
                <span key={i.id} className="inline-block bg-gray-100 rounded-lg px-2 py-1 ml-1 mb-1">
                  {i.name} × {i.quantity}
                </span>
              ))}
            </div>
            {next.length > 0 && (
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- المنتجات ----------

function Products({ token, store }: { token: string; store: any }) {
  const [products, setProducts] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    compareAtPrice: "",
    imageUrl: "",
    trackStock: false,
    stock: "0",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/products`, { token })
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [token, store.id]);

  useEffect(load, [load]);

  async function create() {
    if (!form.name || !form.price) {
      setError("الاسم والسعر مطلوبان");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/stores/${store.id}/products`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          price: Number(form.price),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
          imageUrl: form.imageUrl || undefined,
          trackStock: form.trackStock,
          stock: Number(form.stock) || 0,
        }),
      });
      setForm({ name: "", description: "", price: "", compareAtPrice: "", imageUrl: "", trackStock: false, stock: "0" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: any) {
    await api(`/stores/${store.id}/products/${p.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status: p.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" }),
    });
    load();
  }

  if (!products) return <div className="text-gray-500">جارٍ التحميل...</div>;

  return (
    <div>
      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700"
      >
        {showForm ? "إغلاق" : "+ أضف منتجاً"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl border p-4 mt-4 space-y-3">
          <input className="border rounded-lg px-3 py-2.5 w-full" placeholder="اسم المنتج *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea className="border rounded-lg px-3 py-2.5 w-full" rows={2} placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="border rounded-lg px-3 py-2.5 w-full" placeholder="السعر *" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input type="number" className="border rounded-lg px-3 py-2.5 w-full" placeholder="السعر قبل الخصم" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
          </div>
          <input className="border rounded-lg px-3 py-2.5 w-full" placeholder="رابط صورة المنتج (اختياري)" dir="ltr" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.trackStock} onChange={(e) => setForm({ ...form, trackStock: e.target.checked })} />
              تتبّع المخزون
            </label>
            {form.trackStock && (
              <input type="number" className="border rounded-lg px-3 py-1.5 w-24" placeholder="الكمية" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            )}
          </div>
          <button onClick={create} disabled={busy} className="w-full bg-brand-600 text-white rounded-xl py-2.5 font-bold hover:bg-brand-700 disabled:opacity-60">
            {busy ? "جارٍ الحفظ..." : "حفظ المنتج ✓"}
          </button>
        </div>
      )}

      {error && <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="mt-4 space-y-2">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border p-3 flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                "🛍️"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{p.name}</div>
              <div className="text-brand-700 font-bold text-sm">
                {formatPrice(p.price, store.currency)}
                {p.trackStock && <span className="text-gray-500 font-normal"> · مخزون: {p.stock}</span>}
              </div>
            </div>
            <button
              onClick={() => toggle(p)}
              className={`text-xs rounded-lg px-3 py-1.5 font-semibold ${
                p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              }`}
            >
              {p.status === "ACTIVE" ? "ظاهر ✓" : "مخفي"}
            </button>
          </div>
        ))}
        {products.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-10">أضف أول منتج ليظهر متجرك للعملاء 🛍️</div>
        )}
      </div>
    </div>
  );
}

// ---------- الإعدادات ----------

function Settings({ token, store, onSaved }: { token: string; store: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: store.name,
    description: store.description ?? "",
    whatsapp: store.whatsapp ?? "",
    shippingFee: String(store.shippingFee),
  });
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    try {
      await api(`/stores/${store.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          whatsapp: form.whatsapp || undefined,
          shippingFee: Number(form.shippingFee) || 0,
        }),
      });
      setMsg("حُفظت الإعدادات ✓");
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 max-w-lg space-y-3">
      <label className="block text-sm text-gray-600">
        اسم المتجر
        <input className="border rounded-lg px-3 py-2.5 w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="block text-sm text-gray-600">
        وصف المتجر
        <textarea className="border rounded-lg px-3 py-2.5 w-full mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <label className="block text-sm text-gray-600">
        رقم واتساب المتجر
        <input className="border rounded-lg px-3 py-2.5 w-full mt-1" dir="ltr" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      </label>
      <label className="block text-sm text-gray-600">
        رسوم التوصيل ({CURRENCY_AR[store.currency as keyof typeof CURRENCY_AR]})
        <input type="number" className="border rounded-lg px-3 py-2.5 w-full mt-1" value={form.shippingFee} onChange={(e) => setForm({ ...form, shippingFee: e.target.value })} />
      </label>
      <button onClick={save} className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700">
        حفظ ✓
      </button>
      {msg && <div className="text-sm text-brand-700">{msg}</div>}
    </div>
  );
}
