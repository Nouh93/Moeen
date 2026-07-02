"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

const GOVERNORATES = [
  "أمانة العاصمة", "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "حضرموت",
  "حجة", "البيضاء", "لحج", "أبين", "الضالع", "شبوة", "المهرة", "مأرب",
  "الجوف", "صعدة", "عمران", "المحويت", "ريمة", "سقطرى",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    phone: "",
    password: "",
    governorate: "أمانة العاصمة",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string }>("/merchants/onboard", form);
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: "24px auto" }}>
      <h1>تسجيل متجر جديد</h1>
      <form onSubmit={submit}>
        <label>اسم المسؤول</label>
        <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        <label>اسم النشاط التجاري</label>
        <input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
        <label>رقم الجوال</label>
        <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+9677…" />
        <label>كلمة المرور</label>
        <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
        <label>المحافظة</label>
        <select value={form.governorate} onChange={(e) => set("governorate", e.target.value)}>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: 14 }}>
          <button disabled={loading}>{loading ? "جارٍ التسجيل…" : "إنشاء المتجر"}</button>
        </div>
      </form>
    </div>
  );
}
