"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Gavel,
  LayoutDashboard,
  MessageCircleWarning,
  Store,
} from "lucide-react";
import { api, formatPrice, imgUrl } from "@/lib/api";
import { BrandLogo } from "../components/brand";

/** لوحة إدارة المنصة — Super Admin (القسم 14) */
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("moeen-token"));
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card rounded-2xl p-8 max-w-sm w-full text-center">
          <BrandLogo size={44} />
          <p className="mt-4 text-gray-600">
            سجّل دخولك بحساب الإدارة من{" "}
            <Link href="/dashboard" className="text-brand-600 underline">
              صفحة الدخول
            </Link>{" "}
            ثم عد هنا
          </p>
        </div>
      </main>
    );
  }
  return <Panel token={token} />;
}

const TABS = [
  ["overview", "نظرة عامة", LayoutDashboard],
  ["stores", "التجار", Store],
  ["kyc", "التوثيق", BadgeCheck],
  ["exceptions", "استثناءات الدفع", CircleAlert],
  ["disputes", "النزاعات", Gavel],
  ["reviews", "تقييمات مبلَّغة", MessageCircleWarning],
] as const;

function Panel({ token }: { token: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const [denied, setDenied] = useState("");

  useEffect(() => {
    api("/admin/overview", { token }).catch((e) => setDenied(e.message));
  }, [token]);

  if (denied) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="card rounded-2xl p-8 max-w-sm w-full">
          <div className="text-red-600 font-bold">{denied}</div>
          <Link href="/dashboard" className="text-brand-600 underline text-sm mt-3 inline-block">
            العودة للوحة التاجر
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="brand-header text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <BrandLogo light size={34} />
          <span className="text-xs bg-amber-400 text-brand-950 font-bold rounded-full px-3 py-1">
            إدارة المنصة
          </span>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                tab === id ? "bg-[#f7f5f0] text-brand-800" : "text-brand-200 hover:bg-white/10"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === "overview" && <Overview token={token} />}
        {tab === "stores" && <Stores token={token} />}
        {tab === "kyc" && <Kyc token={token} />}
        {tab === "exceptions" && <Exceptions token={token} />}
        {tab === "disputes" && <Disputes token={token} />}
        {tab === "reviews" && <ReportedReviews token={token} />}
      </div>
    </main>
  );
}

// ---------- نظرة عامة ----------

function Overview({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api("/admin/overview", { token }).then(setData).catch(() => {});
  }, [token]);
  if (!data) return <div className="text-gray-500">جارٍ التحميل...</div>;

  const cards = [
    ["التجار المسجّلون", data.stores],
    ["متاجر نشطة", data.activeStores],
    ["متاجر معلّقة", data.suspended],
    ["طلبات اليوم", data.ordersToday],
    ["طلبات الشهر", data.ordersMonth],
    ["GMV هذا الشهر", formatPrice(data.gmvMonth, "YER_SANAA")],
    ["إيراد الاشتراكات (الشهر)", formatPrice(data.revenueMonth, "YER_SANAA")],
    ["فواتير مسدَّدة (الشهر)", data.paidInvoicesMonth],
  ] as const;
  const alerts = [
    ["توثيقات بانتظار المراجعة", data.pendingKyc, "kyc"],
    ["استثناءات مطابقة", data.exceptions, "exceptions"],
    ["نزاعات مفتوحة", data.openDisputes, "disputes"],
  ] as const;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-brand-800 mt-1">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3 mt-4">
        {alerts.map(([label, value]) => (
          <div
            key={label}
            className={`card p-4 border-2 ${Number(value) > 0 ? "border-amber-400 bg-amber-50" : ""}`}
          >
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${Number(value) > 0 ? "text-amber-700" : "text-brand-800"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- التجار ----------

const STORE_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "نشط", cls: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "معلّق", cls: "bg-red-100 text-red-700" },
  CLOSED: { label: "مغلق", cls: "bg-gray-200 text-gray-600" },
};

function Stores({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    api(`/admin/stores?q=${encodeURIComponent(q)}`, { token }).then(setData).catch(() => {});
  }, [token, q]);
  useEffect(load, [load]);

  async function setStatus(id: string, status: string) {
    const reason =
      status === "ACTIVE" ? undefined : prompt("سبب التعليق (يصل التاجر):") ?? undefined;
    if (status !== "ACTIVE" && !reason) return;
    await api(`/admin/stores/${id}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status, reason }),
    });
    load();
  }

  if (!data) return <div className="text-gray-500">جارٍ التحميل...</div>;
  return (
    <div>
      <input
        className="border rounded-lg px-3 py-2 w-full max-w-md mb-4 bg-white"
        placeholder="بحث بالاسم أو الرابط أو الجوال"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="space-y-2">
        {data.items.map((s: any) => (
          <div key={s.id} className="card p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <div className="font-bold">
                {s.name}{" "}
                <a href={`/s/${s.slug}`} target="_blank" className="text-brand-600 text-xs underline">
                  /s/{s.slug}
                </a>
              </div>
              <div className="text-xs text-gray-500" dir="ltr">
                {s.owner.phone} · {s.owner.name ?? ""}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {s._count.orders} طلب · {s._count.products} منتج · باقة {s.plan} · توثيق مستوى {s.kycLevel}
              </div>
              {s.suspensionReason && (
                <div className="text-xs text-red-600 mt-0.5">سبب التعليق: {s.suspensionReason}</div>
              )}
            </div>
            <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STORE_STATUS[s.status].cls}`}>
              {STORE_STATUS[s.status].label}
            </span>
            {s.status === "ACTIVE" ? (
              <button
                onClick={() => setStatus(s.id, "SUSPENDED")}
                className="text-xs border border-red-300 text-red-600 rounded-lg px-3 py-1.5 font-bold hover:bg-red-50"
              >
                تعليق
              </button>
            ) : (
              <button
                onClick={() => setStatus(s.id, "ACTIVE")}
                className="text-xs border border-green-400 text-green-700 rounded-lg px-3 py-1.5 font-bold hover:bg-green-50"
              >
                إعادة تفعيل
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- طابور التوثيق (القسم 4.3) ----------

function Kyc({ token }: { token: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => {
    api("/admin/kyc", { token }).then(setItems).catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  async function review(id: string, approve: boolean) {
    const adminNote = approve
      ? undefined
      : prompt("سبب الرفض المحدد (يصل التاجر):") ?? undefined;
    if (!approve && !adminNote) return;
    await api(`/admin/kyc/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ approve, adminNote }),
    });
    load();
  }

  if (!items) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (items.length === 0)
    return <div className="text-center text-gray-500 py-16">لا توثيقات بانتظار المراجعة ✓</div>;
  return (
    <div className="space-y-3">
      {items.map((k) => (
        <div key={k.id} className="card p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-bold">{k.store.name}</span>
              <span className="text-xs text-gray-500 mr-2" dir="ltr">{k.store.owner.phone}</span>
              <span className="text-xs bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 mr-2">
                يطلب مستوى {k.level}
              </span>
            </div>
            <span className="text-xs text-gray-400" dir="ltr">
              {new Date(k.createdAt).toLocaleString("ar-u-nu-latn")}
            </span>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            {[["الهوية", k.idImageUrl], ["سيلفي", k.selfieUrl], ["إثبات النشاط", k.proofUrl]]
              .filter(([, u]) => u)
              .map(([label, url]) => (
                <a key={label as string} href={imgUrl(url as string)} target="_blank" className="block">
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(url as string)} alt="" className="w-28 h-28 object-cover rounded-lg border" />
                </a>
              ))}
          </div>
          {k.note && <div className="text-sm text-gray-600 mt-2">ملاحظة التاجر: {k.note}</div>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => review(k.id, true)}
              className="bg-green-600 text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-green-700"
            >
              اعتماد ✓
            </button>
            <button
              onClick={() => review(k.id, false)}
              className="border border-red-300 text-red-600 rounded-lg px-5 py-2 text-sm font-bold hover:bg-red-50"
            >
              رفض بسبب
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- استثناءات المطابقة (القسم 24.1) ----------

function Exceptions({ token }: { token: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => {
    api("/admin/exceptions", { token }).then(setItems).catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  async function resolve(id: string, action: "CREDIT_WALLET" | "IGNORE") {
    const storeId =
      action === "CREDIT_WALLET"
        ? prompt("معرّف المتجر المستفيد (Store ID) — أو اتركه إن كانت الدفعة مرتبطة بفاتورة:") || undefined
        : undefined;
    const note = prompt("ملاحظة التسوية (تُسجَّل في الدفتر):") ?? undefined;
    await api(`/admin/exceptions/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ action, storeId, note }),
    });
    load();
  }

  if (!items) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (items.length === 0)
    return (
      <div className="text-center text-gray-500 py-16">
        لا استثناءات — المطابقة الآلية تعمل بكفاءة ✓ (الهدف ≥ 95%)
      </div>
    );
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div key={e.id} className="card p-4 border-2 border-amber-300">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-mono font-bold" dir="ltr">{e.reference ?? "بلا مرجع"}</span>
            <span className="font-bold text-brand-800">{formatPrice(e.amount, "YER_SANAA")}</span>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{e.source}</span>
            <span className="text-xs text-gray-400" dir="ltr">
              {new Date(e.createdAt).toLocaleString("ar-u-nu-latn")}
            </span>
          </div>
          <div className="text-sm text-red-700 mt-1">{e.error}</div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => resolve(e.id, "CREDIT_WALLET")}
              className="bg-brand-700 text-white rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-brand-800"
            >
              قيّد لمحفظة تاجر
            </button>
            <button
              onClick={() => resolve(e.id, "IGNORE")}
              className="border rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-gray-50"
            >
              إهمال موثَّق
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- النزاعات (القسم 14.3) ----------

function Disputes({ token }: { token: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => {
    api("/admin/disputes", { token }).then(setItems).catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  async function resolve(id: string, forCustomer: boolean) {
    const resolution = prompt("نص القرار (يصل الطرفين):");
    if (!resolution) return;
    await api(`/admin/disputes/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ resolve: forCustomer, resolution }),
    });
    load();
  }

  if (!items) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (items.length === 0)
    return <div className="text-center text-gray-500 py-16">لا نزاعات مفتوحة ✓</div>;
  return (
    <div className="space-y-2">
      {items.map((d) => (
        <div key={d.id} className="card p-4">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-bold">{d.store.name}</span>
            <span className="text-xs text-gray-400" dir="ltr">
              {new Date(d.createdAt).toLocaleString("ar-u-nu-latn")}
            </span>
          </div>
          <div className="text-sm mt-1">سبب النزاع: {d.reason}</div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => resolve(d.id, true)}
              className="bg-green-600 text-white rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-green-700"
            >
              لصالح العميل
            </button>
            <button
              onClick={() => resolve(d.id, false)}
              className="border rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-gray-50"
            >
              لصالح التاجر
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- التقييمات المبلَّغ عنها ----------

function ReportedReviews({ token }: { token: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => {
    api("/admin/reviews/reported", { token }).then(setItems).catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  async function decide(id: string, status: "VISIBLE" | "HIDDEN") {
    await api(`/admin/reviews/${id}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (!items) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (items.length === 0)
    return <div className="text-center text-gray-500 py-16">لا بلاغات ✓</div>;
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="text-sm">
            <b>{r.customerName}</b> قيّم {r.store.name} بـ {r.rating}/5
          </div>
          {r.comment && <div className="text-sm text-gray-600 mt-1">"{r.comment}"</div>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => decide(r.id, "VISIBLE")}
              className="border border-green-400 text-green-700 rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-green-50"
            >
              إبقاؤه (سليم)
            </button>
            <button
              onClick={() => decide(r.id, "HIDDEN")}
              className="border border-red-300 text-red-600 rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-red-50"
            >
              إخفاؤه (مسيء)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
