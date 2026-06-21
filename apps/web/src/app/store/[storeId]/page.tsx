"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, formatYER, setToken } from "@/lib/api";

interface Store { id: string; name: string }
interface Product { id: string; name: string; priceMinor: string; stock: number; imageUrl?: string | null }

const SHIPPING_MINOR = 1000;

const GOVERNORATES = [
  "أمانة العاصمة", "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "حضرموت",
  "حجة", "البيضاء", "لحج", "أبين", "الضالع", "شبوة", "المهرة", "مأرب",
  "الجوف", "صعدة", "عمران", "المحويت", "ريمة", "سقطرى",
];

export default function StorefrontPage() {
  const params = useParams();
  const storeId = String(params.storeId);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>("");

  useEffect(() => {
    api.get<Store>(`/stores/${storeId}`).then(setStore).catch((e) => setError((e as Error).message));
    api.get<Product[]>(`/stores/${storeId}/products`).then(setProducts).catch(() => {});
  }, [storeId]);

  const items = useMemo(
    () => products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id]! })),
    [products, cart],
  );
  const subtotal = items.reduce((s, it) => s + Number(it.priceMinor) * it.qty, 0);
  const total = subtotal + (items.length ? SHIPPING_MINOR : 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const remove = (id: string) =>
    setCart((c) => {
      const n = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  if (error) return <p className="error">{error}</p>;
  if (!store) return <p className="muted">جارٍ التحميل…</p>;

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: "24px auto", textAlign: "center" }}>
        <h1>تم استلام طلبك ✅</h1>
        <p className="muted">رقم الطلب:</p>
        <p style={{ fontFamily: "monospace" }}>{done}</p>
        <p className="muted">سيتواصل معك المتجر لتأكيد التوصيل.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <a href={`/track/${done}`}>
            <button>تتبّع الطلب</button>
          </a>
          <button className="secondary" onClick={() => { setDone(""); setCart({}); }}>
            طلب جديد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{store.name}</h1>
      <p className="muted">تصفّح المنتجات وأضف ما تريد إلى السلة.</p>

      <div className="grid">
        {products.map((p) => (
          <div key={p.id} className="item">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
            )}
            <strong>{p.name}</strong>
            <span className="price">{formatYER(p.priceMinor)}</span>
            <div className="row">
              <button className="secondary" onClick={() => remove(p.id)} disabled={!cart[p.id]}>
                −
              </button>
              <span>{cart[p.id] ?? 0}</span>
              <button onClick={() => add(p.id)}>+</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="muted">لا توجد منتجات في هذا المتجر بعد.</p>}
      </div>

      {items.length > 0 && (
        <Checkout
          storeId={storeId}
          items={items}
          subtotal={subtotal}
          total={total}
          onDone={setDone}
        />
      )}
    </div>
  );
}

function Checkout({
  storeId,
  items,
  subtotal,
  total,
  onDone,
}: {
  storeId: string;
  items: Array<Product & { qty: number }>;
  subtotal: number;
  total: number;
  onDone: (orderId: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [payment, setPayment] = useState<"COD" | "ONLINE">("COD");
  const [addr, setAddr] = useState({ governorate: "أمانة العاصمة", district: "", area: "", landmark: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setA = (k: string, v: string) => setAddr((a) => ({ ...a, [k]: v }));

  async function authCustomer(): Promise<string> {
    // محاولة الدخول، وإلا تسجيل حساب جديد.
    try {
      const r = await api.post<{ accessToken: string }>("/auth/login", { phone, password });
      setToken(r.accessToken);
    } catch {
      const r = await api.post<{ accessToken: string }>("/auth/register", {
        phone,
        password,
        fullName: name || "زبون",
      });
      setToken(r.accessToken);
    }
    const customer = await api.post<{ id: string }>("/customers/me");
    return customer.id;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const customerId = await authCustomer();
      const order = await api.post<{ id: string }>("/orders", {
        storeId,
        customerId,
        paymentMethod: payment,
        shippingMinor: SHIPPING_MINOR,
        items: items.map((it) => ({
          productId: it.id,
          name: it.name,
          unitPriceMinor: Number(it.priceMinor),
          quantity: it.qty,
        })),
        address: {
          governorate: addr.governorate,
          district: addr.district,
          area: addr.area,
          landmark: addr.landmark,
          phone,
          ...(addr.notes ? { notes: addr.notes } : {}),
        },
      });
      onDone(order.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>إتمام الطلب</h2>
      <table>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                {it.name} × {it.qty}
              </td>
              <td>{formatYER(Number(it.priceMinor) * it.qty)}</td>
            </tr>
          ))}
          <tr>
            <td>الشحن</td>
            <td>{formatYER(SHIPPING_MINOR)}</td>
          </tr>
          <tr>
            <th>الإجمالي</th>
            <th>{formatYER(total)}</th>
          </tr>
        </tbody>
      </table>

      <form onSubmit={submit}>
        <label>الاسم</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>رقم الجوال</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9677…" />
        <label>كلمة المرور</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <h2 style={{ marginTop: 16 }}>عنوان التوصيل</h2>
        <label>المحافظة</label>
        <select value={addr.governorate} onChange={(e) => setA("governorate", e.target.value)}>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <label>المديرية</label>
        <input value={addr.district} onChange={(e) => setA("district", e.target.value)} />
        <label>الحي / المنطقة</label>
        <input value={addr.area} onChange={(e) => setA("area", e.target.value)} />
        <label>أقرب معلَم (مهم لوصول المندوب)</label>
        <input value={addr.landmark} onChange={(e) => setA("landmark", e.target.value)} placeholder="مثال: بجانب جامع النور" />
        <label>ملاحظات للمندوب (اختياري)</label>
        <input value={addr.notes} onChange={(e) => setA("notes", e.target.value)} />

        <label>طريقة الدفع</label>
        <select value={payment} onChange={(e) => setPayment(e.target.value as "COD" | "ONLINE")}>
          <option value="COD">الدفع عند الاستلام</option>
          <option value="ONLINE">دفع إلكتروني</option>
        </select>
        {err && <p className="error">{err}</p>}
        <div style={{ marginTop: 14 }}>
          <button disabled={busy || !phone || !password || !addr.district || !addr.area || !addr.landmark}>
            {busy ? "جارٍ الإرسال…" : `تأكيد الطلب · ${formatYER(total)}`}
          </button>
        </div>
      </form>
      <p className="muted" style={{ marginTop: 8 }}>
        المجموع الفرعي: {formatYER(subtotal)}
      </p>
    </div>
  );
}
