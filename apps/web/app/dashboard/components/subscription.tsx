"use client";

import { useCallback, useEffect, useState } from "react";
import { PLANS, PlanId, planPrice } from "@moeen/shared";
import { API_URL, api } from "@/lib/api";

const fmt = (v: string | number) => `${Number(v).toLocaleString("ar-YE")} ريال`;

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "بانتظار السداد", cls: "bg-amber-100 text-amber-700" },
  PAID: { label: "مسدَّدة ✓", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغاة", cls: "bg-gray-200 text-gray-600" },
};

const TXN_LABEL: Record<string, string> = {
  TOPUP: "شحن رصيد",
  CHARGE: "خصم اشتراك",
  CREDIT: "فائض دفع",
  ADJUSTMENT: "تسوية",
};

/** تبويب الاشتراك — الباقات + المحفظة + الفواتير + دفتر الحركات (القسم 24) */
export function Subscription({
  token,
  store,
  onChanged,
}: {
  token: string;
  store: any;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<any>(null);
  const isDev = API_URL.includes("localhost");

  const load = useCallback(() => {
    api(`/stores/${store.id}/billing`, { token })
      .then((d) => {
        setData(d);
        setPendingInvoice(d.invoices.find((i: any) => i.status === "PENDING") ?? null);
      })
      .catch((e) => setError(e.message));
  }, [token, store.id]);

  useEffect(load, [load]);

  async function subscribe(plan: PlanId) {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ paid: boolean; invoice: any }>(
        `/stores/${store.id}/billing/subscribe`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ plan, months: yearly ? 12 : 1 }),
        },
      );
      if (res.paid) onChanged();
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  /** محاكاة سداد عبر المُجمِّع — بيئة التطوير فقط */
  async function devSimulatePay(reference: string, amount: number) {
    setBusy(true);
    try {
      await fetch(`${API_URL}/webhooks/payments/aggregator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-moeen-webhook-secret": "dev-webhook-secret",
        },
        body: JSON.stringify({
          externalId: `DEV-${Date.now()}`,
          reference,
          amount,
        }),
      });
      await new Promise((r) => setTimeout(r, 2500));
      load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">جارٍ التحميل...</div>;

  const currentPlan = data.plan as PlanId;

  return (
    <div className="space-y-6">
      {/* فاتورة معلّقة — الأولوية القصوى */}
      {pendingInvoice && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-amber-900">
                فاتورة بانتظار السداد — {PLANS[pendingInvoice.plan as PlanId].nameAr}
                {pendingInvoice.months === 12 ? " (سنة)" : ""}
              </h3>
              <div className="text-2xl font-bold text-amber-900 mt-1">{fmt(pendingInvoice.amount)}</div>
              <p className="text-sm text-amber-800 mt-2 leading-relaxed">
                ادفع من <b>أي محفظة</b> (جوالي، ONE Cash، فلوسك، الكريمي…) عبر خدمة
                «دفع فاتورة» بكود <b>مُعين</b> والمرجع التالي — ويتفعّل اشتراكك آلياً خلال لحظات:
              </p>
              <div className="mt-2 bg-white rounded-xl px-4 py-2 font-mono text-lg font-bold text-center border border-amber-200" dir="ltr">
                {pendingInvoice.reference}
              </div>
            </div>
          </div>
          {isDev && (
            <button
              onClick={() => devSimulatePay(pendingInvoice.reference, Number(pendingInvoice.amount))}
              disabled={busy}
              className="mt-3 bg-amber-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-amber-700 disabled:opacity-60"
            >
              {busy ? "لحظات..." : "🧪 محاكاة السداد (تطوير)"}
            </button>
          )}
        </div>
      )}

      {/* الباقة الحالية + المحفظة */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card rounded-2xl p-5">
          <div className="text-sm text-gray-500">باقتك الحالية</div>
          <div className="text-2xl font-bold text-brand-700 mt-1">
            {PLANS[currentPlan].nameAr}
          </div>
          {data.currentPeriodEnd && (
            <div className="text-sm text-gray-600 mt-1">
              سارية حتى{" "}
              {new Date(data.currentPeriodEnd).toLocaleDateString("ar-YE", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}
        </div>
        <div className="card rounded-2xl p-5">
          <div className="text-sm text-gray-500">💳 محفظتك المسبقة</div>
          <div className="text-2xl font-bold text-brand-700 mt-1">{fmt(data.walletBalance)}</div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            اشحنها بحوالة أو من أي محفظة بالمرجع{" "}
            <b className="font-mono" dir="ltr">{data.walletReference}</b> — والاشتراك يُخصم منها
            تلقائياً كل دورة.
          </p>
          {isDev && (
            <button
              onClick={() => devSimulatePay(data.walletReference, 10000)}
              disabled={busy}
              className="mt-2 text-sm border border-brand-600 text-brand-700 rounded-lg px-4 py-1.5 font-bold hover:bg-brand-50 disabled:opacity-60"
            >
              🧪 محاكاة شحن 10,000 (تطوير)
            </button>
          )}
        </div>
      </div>

      {/* الباقات */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-bold text-lg">الباقات</h3>
          <div className="bg-white border rounded-full p-1 flex text-sm font-semibold">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 ${!yearly ? "bg-brand-600 text-white" : "text-gray-600"}`}
            >
              شهري
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 ${yearly ? "bg-brand-600 text-white" : "text-gray-600"}`}
            >
              سنوي — شهران مجاناً 🎁
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const isCurrent = id === currentPlan;
            const price = id === "FREE" ? 0 : planPrice(id, yearly ? 12 : 1);
            return (
              <div
                key={id}
                className={`card rounded-2xl border-2 p-5 flex flex-col ${
                  isCurrent ? "border-brand-500 ring-2 ring-brand-100" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-lg">{plan.nameAr}</div>
                  {isCurrent && (
                    <span className="text-xs bg-brand-50 text-brand-700 font-bold rounded-full px-3 py-1">
                      باقتك ✓
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-brand-700">
                    {price === 0 ? "مجاناً" : Number(price).toLocaleString("ar-YE")}
                  </span>
                  {price > 0 && (
                    <span className="text-sm text-gray-500"> ريال / {yearly ? "سنة" : "شهر"}</span>
                  )}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-600">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {id !== "FREE" && !isCurrent && (
                  <button
                    onClick={() => subscribe(id)}
                    disabled={busy}
                    className="mt-4 w-full bg-brand-600 text-white rounded-xl py-2.5 font-bold hover:bg-brand-700 disabled:opacity-60"
                  >
                    اشترك في {plan.nameAr}
                  </button>
                )}
                {id !== "FREE" && isCurrent && (
                  <button
                    onClick={() => subscribe(id)}
                    disabled={busy}
                    className="mt-4 w-full border border-brand-600 text-brand-700 rounded-xl py-2.5 font-bold hover:bg-brand-50 disabled:opacity-60"
                  >
                    جدّد / مدّد {yearly ? "سنة" : "شهراً"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          الدفع عبر محافظ يمنية أو حوالة بالمرجع الفريد — التفعيل آلي فور وصول الدفعة، بلا رفع إيصال وبلا انتظار موظف.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      {/* الفواتير */}
      <div className="card rounded-2xl p-5">
        <h3 className="font-bold mb-3">فواتيرك</h3>
        {data.invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">لا فواتير بعد — أنت على الباقة المجانية</p>
        ) : (
          <div className="space-y-2">
            {data.invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2 last:pb-0 flex-wrap">
                <span className="font-mono font-bold" dir="ltr">{inv.reference}</span>
                <span>{PLANS[inv.plan as PlanId].nameAr}{inv.months === 12 ? " (سنة)" : ""}</span>
                <span className="font-bold">{fmt(inv.amount)}</span>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${INVOICE_STATUS[inv.status].cls}`}>
                  {INVOICE_STATUS[inv.status].label}
                  {inv.paidVia ? ` · ${inv.paidVia === "WALLET" ? "من المحفظة" : "عبر المُجمِّع"}` : ""}
                </span>
                <span className="text-gray-400 text-xs mr-auto" dir="ltr">
                  {new Date(inv.createdAt).toLocaleDateString("ar-YE")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* دفتر المحفظة */}
      <div className="card rounded-2xl p-5">
        <h3 className="font-bold mb-3">حركات المحفظة</h3>
        {data.ledger.length === 0 ? (
          <p className="text-gray-500 text-sm">لا حركات بعد</p>
        ) : (
          <div className="space-y-2">
            {data.ledger.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className={`font-bold ${Number(t.amount) >= 0 ? "text-green-600" : "text-red-500"}`} dir="ltr">
                  {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toLocaleString("ar-YE")}
                </span>
                <span>{TXN_LABEL[t.type] ?? t.type}</span>
                <span className="text-gray-500 text-xs truncate flex-1">{t.note}</span>
                <span className="text-gray-400 text-xs shrink-0">الرصيد: {Number(t.balanceAfter).toLocaleString("ar-YE")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
