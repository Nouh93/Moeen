"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { api, formatPrice } from "@/lib/api";

const BAR = "#404f97"; // brand-600 — لون واحد للسلاسل الأحادية (مُتحقَّق منه)

const fmtNum = (n: number) => n.toLocaleString("ar-u-nu-latn");
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** تقارير المبيعات (القسم 11.2): 30 يوماً + أفضل المنتجات + المحافظات */
export function Reports({ token, store }: { token: string; store: any }) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  useEffect(() => {
    setData(null);
    api(`/stores/${store.id}/reports`, { token }).then(setData).catch((e) => setError(e.message));
  }, [token, store.id]);

  if (error) return <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>;
  if (!data) return <p className="text-gray-500 py-10 text-center">جارٍ تجهيز التقارير...</p>;

  const days: { date: string; orders: number; revenue: number }[] = data.days;
  const maxRev = Math.max(...days.map((d) => d.revenue), 1);
  const total30 = days.reduce((s, d) => s + d.revenue, 0);
  const orders30 = days.reduce((s, d) => s + d.orders, 0);

  // هندسة مخطط الأعمدة: viewBox ثابت والأعمدة رفيعة بفواصل 2px
  const W = 900;
  const H = 200;
  const PAD = 6;
  const bw = (W - PAD * 2) / days.length;

  return (
    <div className="space-y-4 relative">
      {tip && (
        <div
          className="pointer-events-none absolute z-30 bg-brand-950 text-white text-xs rounded-lg px-3 py-2 shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-bold" : ""}>{l}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-xs text-gray-500">مبيعات آخر 30 يوماً</div>
          <div className="text-2xl font-bold text-brand-800 mt-1">{formatPrice(total30, store.currency)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">طلبات آخر 30 يوماً</div>
          <div className="text-2xl font-bold text-brand-800 mt-1">{fmtNum(orders30)}</div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <BarChart3 size={17} className="text-brand-600" /> المبيعات اليومية — آخر 30 يوماً
        </h3>
        {total30 === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">لا مبيعات في آخر 30 يوماً بعد</p>
        ) : (
          <div dir="ltr">
            <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="مخطط المبيعات اليومية">
              {/* خطا شبكة هادئان */}
              <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#23294915" />
              <line x1={PAD} x2={W - PAD} y1={0} y2={0} stroke="#23294915" />
              {days.map((d, i) => {
                const h = d.revenue === 0 ? 2 : Math.max((d.revenue / maxRev) * (H - 10), 4);
                return (
                  <rect
                    key={d.date}
                    x={PAD + i * bw + 1}
                    y={H - h}
                    width={bw - 2}
                    height={h}
                    rx={3}
                    fill={d.revenue === 0 ? "#23294920" : BAR}
                    onMouseEnter={(e) => {
                      const box = (e.currentTarget.ownerSVGElement!.parentNode as HTMLElement)
                        .closest(".relative")!
                        .getBoundingClientRect();
                      setTip({
                        x: Math.min(e.clientX - box.left + 10, box.width - 170),
                        y: e.clientY - box.top + 14,
                        lines: [
                          fmtDay(d.date),
                          `المبيعات: ${formatPrice(d.revenue, store.currency)}`,
                          `الطلبات: ${fmtNum(d.orders)}`,
                        ],
                      });
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                );
              })}
              {/* تواريخ مختارة على المحور */}
              {[0, 7, 14, 21, 29].map((i) => (
                <text key={i} x={PAD + i * bw + bw / 2} y={H + 16} fontSize={11} fill="#6b7280" textAnchor="middle">
                  {fmtDay(days[i].date)}
                </text>
              ))}
            </svg>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <HBarCard
          title="أفضل المنتجات — آخر 90 يوماً"
          rows={data.topProducts.map((p: any) => ({
            label: p.name,
            value: p.revenue,
            valueLabel: formatPrice(p.revenue, store.currency),
            sub: `${fmtNum(p.sold)} قطعة`,
          }))}
          empty="لا مبيعات منتجات بعد"
        />
        <HBarCard
          title="الطلبات حسب المحافظة — آخر 90 يوماً"
          rows={data.byGovernorate.map((g: any) => ({
            label: g.name,
            value: g.orders,
            valueLabel: `${fmtNum(g.orders)} طلب`,
          }))}
          empty="لا طلبات بعد"
        />
      </div>
    </div>
  );
}

/** أعمدة أفقية بملصقات قيم ظاهرة — تقرأ كقائمة وكمخطط معاً */
function HBarCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number; valueLabel: string; sub?: string }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold truncate">{r.label}</span>
                <span className="text-gray-600 shrink-0">
                  {r.valueLabel}
                  {r.sub && <span className="text-xs text-gray-400"> · {r.sub}</span>}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full mt-1 overflow-hidden" dir="ltr">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: BAR }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
