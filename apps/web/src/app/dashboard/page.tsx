"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, formatYER, getToken } from "@/lib/api";

interface StoreInfo { id: string; name: string; slug: string; merchantPaysShipping: boolean }
interface Subscription { status: string; priceMinor: string }
interface Merchant {
  id: string;
  businessName: string;
  status: string;
  governorate: string;
  walletBalanceMinor: string;
  settlementBalanceMinor: string;
  store: StoreInfo | null;
  subscription: Subscription | null;
}
interface Payout { id: string; amountMinor: string; status: string; createdAt: string }
interface Product { id: string; name: string; priceMinor: string; stock: number; isActive: boolean; imageUrl?: string | null }
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
        api.get<{ items: Order[] }>(`/orders?merchantId=${m.id}&perPage=50`),
        m.store
          ? api.get<{ items: Product[] }>(`/stores/${m.store.id}/products?all=1&perPage=100`)
          : Promise.resolve({ items: [] as Product[] }),
      ]);
      setOrders(o.items);
      setProducts(p.items);
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
        {merchant.subscription && (
          <>
            {" · "}
            اشتراك: {formatYER(merchant.subscription.priceMinor)}/شهر{" "}
            <span className={`badge ${merchant.subscription.status === "ACTIVE" ? "ok" : "warn"}`}>
              {subStatusLabel(merchant.subscription.status)}
            </span>
          </>
        )}
      </p>

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="card">
        <h2>المحفظة (رصيد مدفوع مسبقاً)</h2>
        <div className="stat">{formatYER(merchant.walletBalanceMinor)}</div>
        <TopUp merchantId={merchant.id} reload={load} />
      </div>

      <div className="card">
        <h2>مبيعاتي القابلة للسحب</h2>
        <div className="stat">{formatYER(merchant.settlementBalanceMinor)}</div>
        <Payouts merchantId={merchant.id} available={merchant.settlementBalanceMinor} reload={load} />
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
              <ProductCard key={p.id} product={p} onDone={flash} />
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
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatYER(o.totalMinor)}</td>
                  <td>{o.paymentMethod === "COD" ? "عند الاستلام" : "إلكتروني"}</td>
                  <td>{statusLabel(o.status)}</td>
                  <td>
                    <OrderActions order={o} onDone={flash} />
                  </td>
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

function Payouts({ merchantId, available, reload }: { merchantId: string; available: string; reload: () => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [list, setList] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => {
    api.get<Payout[]>(`/merchants/${merchantId}/payouts`).then(setList).catch(() => {});
  }, [merchantId]);
  useEffect(() => { refresh(); }, [refresh, available]);

  async function go() {
    setErr("");
    setBusy(true);
    try {
      await api.post(`/merchants/${merchantId}/payouts`, { amountMinor: String(Number(amount)) });
      setAmount("");
      await reload();
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const label: Record<string, string> = { PENDING: "قيد الصرف", PAID: "صُرف", CANCELLED: "ملغى" };
  return (
    <div>
      <div className="row" style={{ marginTop: 12 }}>
        <input style={{ maxWidth: 200 }} placeholder="مبلغ السحب (ريال)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button onClick={go} disabled={busy || !amount || Number(amount) <= 0}>طلب سحب</button>
      </div>
      {err && <p className="error">{err}</p>}
      {list.length > 0 && (
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>المبلغ</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{formatYER(p.amountMinor)}</td>
                <td><span className={`badge ${p.status === "PAID" ? "ok" : "warn"}`}>{label[p.status] ?? p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProductCard({ product, onDone }: { product: Product; onDone: (m: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [price, setPrice] = useState(String(Number(product.priceMinor)));
  const [stock, setStock] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/products/${product.id}`, { priceMinor: Number(price), stock: Number(stock) });
      setEdit(false);
      onDone("حُفظ المنتج");
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!confirm(`حذف «${product.name}»؟`)) return;
    await api.del(`/products/${product.id}`);
    onDone("حُذف المنتج");
  }

  return (
    <div className="item" style={{ opacity: product.isActive ? 1 : 0.55 }}>
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8 }} />
      )}
      <strong>{product.name}</strong>
      {edit ? (
        <>
          <label>السعر (ريال)</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} />
          <label>المخزون</label>
          <input value={stock} onChange={(e) => setStock(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <button onClick={save} disabled={busy}>حفظ</button>
            <button className="secondary" onClick={() => setEdit(false)}>إلغاء</button>
          </div>
        </>
      ) : (
        <>
          <span className="price">{formatYER(product.priceMinor)}</span>
          <span className="muted">
            المخزون: {product.stock}
            {product.stock <= 5 && product.stock > 0 ? " (منخفض)" : ""}
            {product.stock <= 0 ? " — نفد" : ""}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className="secondary" onClick={() => setEdit(true)}>تعديل</button>
            <button
              className="secondary"
              onClick={async () => {
                await api.patch(`/products/${product.id}`, { isActive: !product.isActive });
                onDone(product.isActive ? "عُطّل المنتج" : "فُعّل المنتج");
              }}
            >
              {product.isActive ? "تعطيل" : "تفعيل"}
            </button>
            <button className="secondary" onClick={del}>حذف</button>
          </div>
        </>
      )}
    </div>
  );
}

function AddProduct({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api.post(`/stores/${storeId}/products`, {
        name,
        priceMinor: Number(price),
        stock: stock ? Number(stock) : 0,
        ...(imageUrl ? { imageUrl } : {}),
      });
      setName("");
      setPrice("");
      setStock("");
      setImageUrl("");
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
      <input style={{ maxWidth: 220 }} placeholder="رابط صورة (اختياري)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      <button onClick={go} disabled={busy || !name || !price}>
        إضافة منتج
      </button>
    </div>
  );
}

function OrderActions({ order, onDone }: { order: Order; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const ship = order.shipment;
  async function call(path: string, ok: string) {
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/shipment/${path}`);
      onDone(ok);
    } catch (e) {
      onDone((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (order.status === "DELIVERED") {
    return (
      <div className="row" style={{ gap: 6 }}>
        <span className="muted">✓ تم</span>
        <button className="secondary" disabled={busy} onClick={() => call("return", "تم الاسترداد")}>
          استرداد
        </button>
      </div>
    );
  }
  if (order.status === "CANCELLED") return <span className="muted">—</span>;
  if (order.status === "RETURNED") return <span className="muted">مُرجَع</span>;
  if (!ship) {
    return (
      <button disabled={busy} onClick={() => call("waybill", "أُنشئت البوليصة")}>
        إنشاء بوليصة
      </button>
    );
  }
  if (ship.status === "CREATED") {
    return (
      <div className="row" style={{ gap: 6 }}>
        <button disabled={busy} onClick={() => call("deliver", "تم تأكيد التسليم")}>
          تأكيد التسليم
        </button>
        <button className="secondary" disabled={busy} onClick={() => call("cancel", "أُلغيت البوليصة")}>
          إلغاء
        </button>
      </div>
    );
  }
  return <span className="muted">{ship.waybillNumber}</span>;
}

function subStatusLabel(s: string): string {
  const map: Record<string, string> = {
    ACTIVE: "نشط",
    PAST_DUE: "متأخّر",
    SUSPENDED: "موقوف",
    CANCELLED: "ملغى",
  };
  return map[s] ?? s;
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
