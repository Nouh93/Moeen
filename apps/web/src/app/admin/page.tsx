"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clearToken, formatYER, getToken, setToken } from "@/lib/api";

interface Stats {
  merchantsTotal: number;
  merchantsActive: number;
  merchantsSuspended: number;
  ordersTotal: number;
  ordersDelivered: number;
  platformRevenueMinor: string;
  paymentExceptions: number;
}
interface AdminMerchant {
  id: string;
  businessName: string;
  governorate: string;
  status: string;
  trustedBadge: boolean;
  featuredBadge: boolean;
  user: { phone: string };
}
interface PendingPayout {
  id: string;
  amountMinor: string;
  merchant: { businessName: string };
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [s, m, p] = await Promise.all([
        api.get<Stats>("/admin/stats"),
        api.get<AdminMerchant[]>("/admin/merchants"),
        api.get<PendingPayout[]>("/admin/payouts"),
      ]);
      setStats(s);
      setMerchants(m);
      setPayouts(p);
      setAuthed(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("للمشرفين")) setError("هذا الحساب ليس مشرفاً.");
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!authed) return <AdminLogin onLogin={load} error={error} />;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>لوحة الإدارة</h1>
        <button className="secondary" onClick={() => { clearToken(); setAuthed(false); }}>
          خروج
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      {stats && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
          <Stat label="التجار" value={String(stats.merchantsTotal)} />
          <Stat label="نشط" value={String(stats.merchantsActive)} />
          <Stat label="موقوف" value={String(stats.merchantsSuspended)} />
          <Stat label="الطلبات" value={String(stats.ordersTotal)} />
          <Stat label="مُسلّمة" value={String(stats.ordersDelivered)} />
          <Stat label="دخل المنصة" value={formatYER(stats.platformRevenueMinor)} />
          <Stat label="استثناءات الدفع" value={String(stats.paymentExceptions)} />
        </div>
      )}

      <div className="card">
        <h2>طلبات السحب المعلّقة</h2>
        {payouts.length === 0 && <p className="muted">لا توجد طلبات سحب معلّقة.</p>}
        {payouts.length > 0 && (
          <table>
            <thead><tr><th>التاجر</th><th>المبلغ</th><th>إجراء</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.merchant.businessName}</td>
                  <td>{formatYER(p.amountMinor)}</td>
                  <td>
                    <button onClick={() => act(() => api.post(`/admin/payouts/${p.id}/paid`, {}), "تم تأكيد الصرف")}>
                      تأكيد الصرف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>التجار</h2>
        <table>
          <thead>
            <tr>
              <th>المتجر</th>
              <th>المحافظة</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.businessName} {m.trustedBadge && "🏅"} {m.featuredBadge && "⭐"}
                  <div className="muted">{m.user.phone}</div>
                </td>
                <td>{m.governorate}</td>
                <td>
                  <span className={`badge ${m.status === "ACTIVE" ? "ok" : "warn"}`}>{m.status}</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button onClick={() => act(() => api.post(`/admin/merchants/${m.id}/verify`), "فُعّل")}>
                      تفعيل
                    </button>
                    <button
                      className="secondary"
                      onClick={() => act(() => api.post(`/admin/merchants/${m.id}/suspend`), "عُلّق")}
                    >
                      تعليق
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        act(() => api.post(`/admin/merchants/${m.id}/badges`, { trusted: !m.trustedBadge }), "حُدّثت الشارة")
                      }
                    >
                      🏅
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--brand-dark)" }}>{value}</div>
    </div>
  );
}

function AdminLogin({ onLogin, error }: { onLogin: () => void; error: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/bootstrap-admin";
      const body = mode === "login" ? { phone, password } : { phone, password, fullName };
      const res = await api.post<{ accessToken: string }>(path, body);
      setToken(res.accessToken);
      onLogin();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "24px auto" }}>
      <h1>لوحة الإدارة</h1>
      <p className="muted">
        {mode === "login" ? "دخول المشرف" : "إنشاء أول مشرف للنظام (مرة واحدة)"}
      </p>
      <form onSubmit={submit}>
        {mode === "bootstrap" && (
          <>
            <label>الاسم</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </>
        )}
        <label>رقم الجوال</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9677…" />
        <label>كلمة المرور</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {(err || error) && <p className="error">{err || error}</p>}
        <div style={{ marginTop: 14 }}>
          <button>{mode === "login" ? "دخول" : "إنشاء المشرف"}</button>
        </div>
      </form>
      <p className="muted" style={{ marginTop: 12 }}>
        <a onClick={() => setMode(mode === "login" ? "bootstrap" : "login")} style={{ cursor: "pointer" }}>
          {mode === "login" ? "أول مرة؟ أنشئ أول مشرف" : "← لديّ حساب مشرف"}
        </a>
      </p>
    </div>
  );
}
