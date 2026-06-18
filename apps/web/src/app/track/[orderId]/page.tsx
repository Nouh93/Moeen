"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, formatYER } from "@/lib/api";

interface Tracking {
  id: string;
  status: string;
  paymentMethod: string;
  totalMinor: string;
  createdAt: string;
  store: { name: string };
  shipment: { status: string; waybillNumber: string } | null;
  items: Array<{ nameSnapshot: string; quantity: number; unitPriceMinor: string }>;
}

const STEPS = [
  { key: "PENDING", label: "تم الطلب" },
  { key: "SHIPPED", label: "قيد الشحن" },
  { key: "DELIVERED", label: "تم التسليم" },
];

export default function TrackPage() {
  const params = useParams();
  const orderId = String(params.orderId);
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchIt = () =>
      api.get<Tracking>(`/track/${orderId}`).then(setData).catch((e) => setError((e as Error).message));
    fetchIt();
    const t = setInterval(fetchIt, 5000); // تحديث دوري للحالة
    return () => clearInterval(t);
  }, [orderId]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">جارٍ التحميل…</p>;

  const shipped = data.shipment && data.shipment.status !== "CREATED";
  const delivered = data.status === "DELIVERED";
  const cancelled = data.status === "CANCELLED" || data.status === "RETURNED";
  const activeIdx = delivered ? 2 : shipped ? 1 : 0;

  return (
    <div>
      <h1>تتبّع الطلب</h1>
      <p className="muted">من متجر {data.store.name}</p>

      <div className="card">
        {cancelled ? (
          <p className="error">هذا الطلب {data.status === "RETURNED" ? "مُرجَع" : "ملغى"}.</p>
        ) : (
          <div className="row" style={{ justifyContent: "space-between" }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    margin: "0 auto 6px",
                    background: i <= activeIdx ? "var(--brand)" : "#e5e7eb",
                    color: "#fff",
                    lineHeight: "34px",
                    fontWeight: 800,
                  }}
                >
                  {i <= activeIdx ? "✓" : i + 1}
                </div>
                <div className="muted" style={{ fontWeight: i === activeIdx ? 800 : 400 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>تفاصيل الطلب</h2>
        <table>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i}>
                <td>
                  {it.nameSnapshot} × {it.quantity}
                </td>
                <td>{formatYER(Number(it.unitPriceMinor) * it.quantity)}</td>
              </tr>
            ))}
            <tr>
              <th>الإجمالي</th>
              <th>{formatYER(data.totalMinor)}</th>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          الدفع: {data.paymentMethod === "COD" ? "عند الاستلام" : "إلكتروني"}
          {data.shipment ? ` · بوليصة ${data.shipment.waybillNumber}` : ""}
        </p>
      </div>
    </div>
  );
}
