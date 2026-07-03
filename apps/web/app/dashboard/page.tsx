"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CURRENCY_AR } from "@moeen/shared";
import { api } from "@/lib/api";
import { Overview } from "./components/overview";
import { Orders } from "./components/orders";
import { Products } from "./components/products";
import { Coupons } from "./components/coupons";
import { Settings } from "./components/settings";

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
        <h1 className="text-center text-lg font-semibold mt-2 text-gray-600">دخول التاجر</h1>
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
        {error && <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      </div>
    </main>
  );
}

// ---------- اللوحة ----------

const TABS = [
  ["overview", "📊 نظرة عامة"],
  ["orders", "📦 الطلبات"],
  ["products", "🛍️ المنتجات"],
  ["coupons", "🎟️ الكوبونات"],
  ["settings", "⚙️ الإعدادات"],
] as const;

type TabId = (typeof TABS)[number][0];

function Panel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stores, setStores] = useState<any[] | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
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
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">{store.name}</div>
            <a href={`/s/${store.slug}`} target="_blank" className="text-brand-100 text-xs underline">
              /s/{store.slug} — افتح متجرك ↗
            </a>
          </div>
          <button onClick={onLogout} className="text-sm bg-white/15 rounded-lg px-3 py-1.5 hover:bg-white/25">
            خروج
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 rounded-t-lg text-sm font-semibold whitespace-nowrap ${
                tab === id ? "bg-gray-50 text-brand-700" : "text-brand-100 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {tab === "overview" && <Overview token={token} store={store} />}
        {tab === "orders" && <Orders token={token} store={store} />}
        {tab === "products" && <Products token={token} store={store} />}
        {tab === "coupons" && <Coupons token={token} store={store} />}
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
        <p className="text-gray-500 text-sm text-center mt-1">ثلاث خطوات ومتجرك يستقبل الطلبات</p>
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
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
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
              <option key={k} value={k}>
                عملة الأسعار: {v}
              </option>
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
        {error && <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
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
