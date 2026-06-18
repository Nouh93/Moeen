"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, formatYER, getToken } from "@/lib/api";

interface StoreInfo { id: string; name: string; slug: string; merchantPaysShipping: boolean }
interface Merchant {
  id: string;
  businessName: string;
  status: string;
  governorate: string;
  walletBalanceMinor: string;
  store: StoreInfo | null;
}
interface Product { id: string; name: string; priceMinor: string; stock: number; isActive: boolean }
interface Order {
  id: string;
  status: string;
  paymentMethod: string;
  totalMinor: string;
  shipment?: { status: string; waybillNumber: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await api.get<Merchant>("/merchants/me");
      setMerchant(m);
      const [o, p] = await Promise.all([
        api.get<Order[]>(`/orders?merchantId=${m.id}`),
        m.store ? api.get<Product[]>(`/stores/${m.store.id}/products?all=1`) : Promise.resolve([]),
      ]);
      setOrders(o);
      setProducts(p);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
  }

  function flash(m: string) {
    setMsg(m);
    setError("");
    void load();
  }

  if (!merchant) {
    return <p className="muted">جارٍ التحميل… {error && <span className="error">{error}</span>}</p>;
  }
  const store = merchant.store;
  const storeUrl = store ? `${window.location.origin}/store/${store.id}` : "";

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{merchant.businessName}</h1>
        <button className="secondary" onClick={logout}>
          خروج
        </button>
      </div>
      <p className="muted">
        {merchant.governorate} ·{" "}
        <span className={`badge ${merchant.status === "ACTIVE" ? "ok" : "warn"}`}>
          {statusLabel(merchant.status)}
        </span>
      </p>

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="card">
        <h2>المحفظة</h2>
        <div className="stat">{formatYER(merchant.walletBalanceMinor)}</div>
        <TopUp merchantId={merchant.id} reload={load} />
      </div>

      {store && (
        <div className="card">
          <h2>متجري</h2>
          <p>
            <a href={`/store/${store.id}`} target="_blank" rel="noreferrer">
              فتح صفحة المتجر ↗
            </a>
          </p>
          <label>رابط متجرك (شاركه مع زبائنك)</label>
          <input readOnly value={storeUrl} onFocus={(e) => e.currentTarget.select()} />
          <label className="row" style={{ marginTop: 12, gap: 6 }}>
            <input
              type="checkbox"
              style={{ width: 18 }}
              checked={store.merchantPaysShipping}
              onChange={async (e) => {
                await api.patch(`/stores/${store.id}`, { merchantPaysShipping: e.target.checked });
                flash("حُفظ إعداد الشحن");
              }}
            />
            أتحمّل أنا تكلفة الشحن (توصيل مجاني للزبون)
          </label>
        </div>
      )}

      {store && (
        <div className="card">
          <h2>المنتجات</h2>
          <div className="grid">
            {products.map((p) => (
              <div key={p.id} className="item">
                <strong>{p.name}</strong>
                <span className="price">{formatYER(p.priceMinor)}</span>
                <span className="muted">المخزون: {p.stock}</span>
              </div>
            ))}
            {products.length === 0 && <p className="muted">لا توجد منتجات بعد — أضف أول منتج.</p>}
          </div>
          <AddProduct storeId={store.id} onDone={() => flash("أُضيف المنتج")} />
        </div>
      )}

      <div className="card">
        <h2>الطلبات</h2>
        {orders.length === 0 && <p className="muted">لا توجد طلبات بعد.</p>}
        {orders.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>الإجمالي</th>
                <th>الدفع</th>
                <th>الحالة</th>
                <th>الشحنة</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatYER(o.totalMinor)}</td>
                  <td>{o.paymentMethod === "COD" ? "عند الاستلام" : "إلكتروني"}</td>
                  <td>{statusLabel(o.status)}</td>
                  <td>{o.shipment ? o.shipment.waybillNumber : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TopUp({ merchantId, reload }: { merchantId: string; reload: () => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setErr("");
    setBusy(true);
    try {
      await api.post(`/merchants/${merchantId}/wallet/topup`, {
        amountMinor: String(Number(amount)),
        reference: `topup-${Date.now()}`,
      });
      setAmount("");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <input
        style={{ maxWidth: 200 }}
        placeholder="مبلغ الشحن (ريال)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={go} disabled={busy || !amount}>
        شحن المحفظة
      </button>
      {err && <span className="error">{err}</span>}
    </div>
  );
}

function AddProduct({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api.post(`/stores/${storeId}/products`, {
        name,
        priceMinor: Number(price),
        stock: stock ? Number(stock) : 0,
      });
      setName("");
      setPrice("");
      setStock("");
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <input style={{ maxWidth: 180 }} placeholder="اسم المنتج" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ maxWidth: 140 }} placeholder="السعر (ريال)" value={price} onChange={(e) => setPrice(e.target.value)} />
      <input style={{ maxWidth: 120 }} placeholder="المخزون" value={stock} onChange={(e) => setStock(e.target.value)} />
      <button onClick={go} disabled={busy || !name || !price}>
        إضافة منتج
      </button>
    </div>
  );
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    ACTIVE: "نشط",
    PENDING: "قيد المراجعة",
    SUSPENDED: "موقوف",
    CLOSED: "مغلق",
    DELIVERED: "تم التسليم",
    CONFIRMED: "مؤكَّد",
    SHIPPED: "قيد الشحن",
    CANCELLED: "ملغى",
    RETURNED: "مُرجَع",
  };
  return map[s] ?? s;
}
