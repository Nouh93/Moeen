"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Package, Store as StoreIcon } from "lucide-react";
import { ORDER_STATUS_AR } from "@moeen/shared";
import { api, formatPrice, imgUrl } from "@/lib/api";
import { BrandLogo } from "@/app/components/brand";

const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-amber-50 text-amber-700",
  OUT_FOR_DELIVERY: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  RETURNED: "bg-red-50 text-red-600",
};

/** «طلباتي» — المشتري يدخل برقمه ويرى طلباته من كل المتاجر (القسم 6.4) */
export default function MyOrders() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("moeen-token"));
    setReady(true);
  }, []);

  if (!ready) return null;
  return token ? (
    <OrdersList
      token={token}
      onLogout={() => {
        localStorage.removeItem("moeen-token");
        setToken(null);
      }}
    />
  ) : (
    <Login
      onLogin={(t) => {
        localStorage.setItem("moeen-token", t);
        setToken(t);
      }}
    />
  );
}

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
      <div className="card rounded-2xl p-8 max-w-sm w-full">
        <Link href="/" className="flex justify-center">
          <BrandLogo size={44} />
        </Link>
        <h1 className="text-center text-lg font-semibold mt-2 text-gray-600">طلباتي</h1>
        <p className="text-center text-xs text-gray-500 mt-1">
          أدخل رقم جوالك الذي طلبت به — نرسل لك رمز تحقق ونعرض كل طلباتك
        </p>
        {step === "phone" ? (
          <>
            <input
              className="border rounded-lg px-3 py-3 w-full mt-5"
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

function OrdersList({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any[]>("/me/orders", { token })
      .then(setOrders)
      .catch((e) => {
        // جلسة منتهية → عودة للدخول
        if (/unauthorized|401/i.test(e.message)) onLogout();
        else setError(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="min-h-screen">
      <header className="brand-header text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/">
            <BrandLogo size={34} light />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package size={20} /> طلباتي
          </h1>
          <button
            onClick={onLogout}
            className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1"
          >
            <LogOut size={14} /> خروج
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
        {orders === null && !error && <p className="text-center text-gray-500 py-16">جارٍ التحميل...</p>}
        {orders?.length === 0 && (
          <p className="text-center text-gray-500 py-16">
            لا توجد طلبات بهذا الرقم بعد — تسوّق من متاجر مُعين وستجد طلباتك هنا
          </p>
        )}
        <div className="space-y-3">
          {orders?.map((o) => (
            <Link key={o.id} href={`/track/${o.code}`} className="card p-4 flex items-center gap-3 hover:shadow-lg">
              <div className="w-11 h-11 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {o.store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(o.store.logoUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon size={20} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {o.store.name}
                  <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${STATUS_COLOR[o.status] ?? "bg-gray-100"}`}>
                    {ORDER_STATUS_AR[o.status as keyof typeof ORDER_STATUS_AR] ?? o.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {o.items.map((i: any) => i.name).join("، ")}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 font-mono" dir="ltr">
                  {o.code} · {new Date(o.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
              <div className="font-bold text-brand-700 shrink-0">{formatPrice(o.total, o.store.currency)}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
