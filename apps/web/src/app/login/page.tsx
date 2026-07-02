"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string }>("/auth/login", { phone, password });
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "24px auto" }}>
      <h1>دخول التاجر</h1>
      <form onSubmit={submit}>
        <label>رقم الجوال</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9677…" />
        <label>كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: 14 }}>
          <button disabled={loading}>{loading ? "جارٍ الدخول…" : "دخول"}</button>
        </div>
      </form>
      <p className="muted" style={{ marginTop: 12 }}>
        ليس لديك متجر؟ <a href="/register">سجّل الآن</a>
      </p>
    </div>
  );
}
