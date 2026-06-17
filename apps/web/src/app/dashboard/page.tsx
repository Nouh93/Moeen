"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, formatYER, getToken } from "@/lib/api";

interface Merchant {
  id: string;
  businessName: string;
  status: string;
  governorate: string;
  walletBalanceMinor: string;
}
interface Store { id: string; name: string; merchantPaysShipping: boolean }
interface Product { id: string; name: string; priceMinor: string; stock: number }
interface Order {
  id: string;
  status: string;
  paymentMethod: string;
  totalMinor: string;
  createdAt: string;
  shipment?: { status: string; waybillNumber: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeStore, setActiveStore] = useState<string>("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await api.get<Merchant>("/merchants/me");
      setMerchant(m);
      const [s, o] = await Promise.all([
        api.get<Store[]>(`/merchants/${m.id}/stores`),
        api.get<Order[]>(`/orders?merchantId=${m.id}`),
      ]);
      setStores(s);
      setOrders(o);
      if (s[0] && !activeStore) setActiveStore(s[0].id);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [activeStore]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeStore) return;
    void api.get<Product[]>(`/stores/${activeStore}/products?all=1`).then(setProducts).catch(() => {});
  }, [activeStore, msg]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  async function action(fn: () => Promise<unknown>, ok: string) {
    setError("");
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!merchant) {
    return <p className="muted">جارٍ التحميل… {error && <span className="error">{error}</span>}</p>;
  }

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
        <TopUp merchantId={merchant.id} onDone={(m) => action(async () => {}, m)} reload={load} />
      </div>

      <div className="card">
        <h2>المتاجر</h2>
        {stores.length === 0 && <p className="muted">لا توجد متاجر بعد — أنشئ متجرك الأول.</p>}
        <div className="grid">
          {stores.map((s) => (
            <div key={s.id} className="item">
              <strong>{s.name}</strong>
              <span className="muted">
                الشحن: {s.merchantPaysShipping ? "على التاجر" : "على العميل"}
              </span>
              <a className="muted" href={`/store/${s.id}`} target="_blank" rel="noreferrer">
                رابط المتجر للزبائن ↗
              </a>
            </div>
          ))}
        </div>
        <CreateStore merchantId={merchant.id} reload={load} />
      </div>

      {stores.length > 0 && (
        <div className="card">
          <h2>المنتجات</h2>
          <label>اختر المتجر</label>
          <select value={activeStore} onChange={(e) => setActiveStore(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="grid" style={{ marginTop: 12 }}>
            {products.map((p) => (
              <div key={p.id} className="item">
                <strong>{p.name}</strong>
                <span className="price">{formatYER(p.priceMinor)}</span>
                <span className="muted">المخزون: {p.stock}</span>
              </div>
            ))}
          </div>
          <AddProduct storeId={activeStore} onDone={() => setMsg("أُضيف المنتج")} />
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
                  <td>{o.shipment ? `${o.shipment.waybillNumber}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TopUp({ merchantId, reload }: { merchantId: string; onDone?: (m: string) => void; reload: () => Promise<void> }) {
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

function CreateStore({ merchantId, reload }: { merchantId: string; reload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [merchantPays, setMerchantPays] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api.post(`/merchants/${merchantId}/stores`, { name, merchantPaysShipping: merchantPays });
      setName("");
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <input style={{ maxWidth: 220 }} placeholder="اسم المتجر" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="row" style={{ margin: 0, gap: 6 }}>
        <input
          type="checkbox"
          style={{ width: 18 }}
          checked={merchantPays}
          onChange={(e) => setMerchantPays(e.target.checked)}
        />
        التاجر يتحمّل الشحن
      </label>
      <button onClick={go} disabled={busy || !name}>
        إضافة متجر
      </button>
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
