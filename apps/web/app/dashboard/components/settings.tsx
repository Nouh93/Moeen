"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENCY_AR } from "@moeen/shared";
import { Camera, Store as StoreIcon } from "lucide-react";
import { api, imgUrl, uploadFile } from "@/lib/api";
import { KycSection } from "./kyc-section";
import { Appearance } from "./appearance";

export function Settings({
  token,
  store,
  onSaved,
}: {
  token: string;
  store: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: store.name,
    description: store.description ?? "",
    whatsapp: store.whatsapp ?? "",
    logoUrl: store.logoUrl ?? "",
    shippingFee: String(store.shippingFee),
    freeShippingAbove: store.freeShippingAbove ? String(store.freeShippingAbove) : "",
    minOrderTotal: store.minOrderTotal ? String(store.minOrderTotal) : "",
    vacationMode: !!store.vacationMode,
    vacationMessage: store.vacationMessage ?? "",
    thankYouNote: store.thankYouNote ?? "",
  });
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // أسعار الشحن لكل محافظة (القسم 8.2)
  const [governorates, setGovernorates] = useState<any[]>([]);
  const [rates, setRates] = useState<any[] | null>(null);
  const [rateForm, setRateForm] = useState({ governorateId: 0, fee: "", etaText: "" });

  const loadRates = useCallback(() => {
    api<any[]>(`/stores/${store.id}/shipping-rates`, { token }).then(setRates).catch(() => {});
  }, [token, store.id]);

  useEffect(() => {
    api<any[]>("/public/yemen/governorates").then(setGovernorates).catch(() => {});
    loadRates();
  }, [loadRates]);

  async function pickLogo(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file, token);
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setMsg("");
    try {
      await api(`/stores/${store.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          whatsapp: form.whatsapp || undefined,
          logoUrl: form.logoUrl || undefined,
          shippingFee: Number(form.shippingFee) || 0,
          freeShippingAbove: form.freeShippingAbove ? Number(form.freeShippingAbove) : undefined,
          minOrderTotal: form.minOrderTotal ? Number(form.minOrderTotal) : null,
          vacationMode: form.vacationMode,
          vacationMessage: form.vacationMessage.trim() || null,
          thankYouNote: form.thankYouNote.trim() || null,
        }),
      });
      setMsg("حُفظت الإعدادات ✓");
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function addRate() {
    if (!rateForm.governorateId || !rateForm.fee) return;
    await api(`/stores/${store.id}/shipping-rates`, {
      method: "POST",
      token,
      body: JSON.stringify({
        governorateId: Number(rateForm.governorateId),
        fee: Number(rateForm.fee),
        etaText: rateForm.etaText || undefined,
      }),
    });
    setRateForm({ governorateId: 0, fee: "", etaText: "" });
    loadRates();
  }

  async function removeRate(id: string) {
    await api(`/stores/${store.id}/shipping-rates/${id}`, { method: "DELETE", token });
    loadRates();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <Appearance token={token} store={store} onSaved={onSaved} />
      <KycSection token={token} store={store} />
      <div className="card p-4 space-y-3">
        <h3 className="font-bold">بيانات المتجر</h3>

        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden shrink-0">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(form.logoUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <StoreIcon size={24} className="text-gray-300" strokeWidth={1.5} />
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])}
          />
          <button
            onClick={() => logoRef.current?.click()}
            disabled={uploading}
            className="border rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "جارٍ الرفع..." : (<span className="inline-flex items-center gap-1.5"><Camera size={15} /> شعار المتجر</span>)}
          </button>
        </div>

        <label className="block text-sm text-gray-600">
          اسم المتجر
          <input
            className="border rounded-lg px-3 py-2.5 w-full mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block text-sm text-gray-600">
          وصف المتجر
          <textarea
            className="border rounded-lg px-3 py-2.5 w-full mt-1"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="block text-sm text-gray-600">
          رقم واتساب المتجر (تصلك عليه إشعارات الطلبات)
          <input
            className="border rounded-lg px-3 py-2.5 w-full mt-1"
            dir="ltr"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-gray-600">
            رسوم التوصيل الافتراضية ({CURRENCY_AR[store.currency as keyof typeof CURRENCY_AR]})
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full mt-1"
              value={form.shippingFee}
              onChange={(e) => setForm({ ...form, shippingFee: e.target.value })}
            />
          </label>
          <label className="block text-sm text-gray-600">
            توصيل مجاني فوق مبلغ (اختياري)
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full mt-1"
              placeholder="مثال: 50000"
              value={form.freeShippingAbove}
              onChange={(e) => setForm({ ...form, freeShippingAbove: e.target.value })}
            />
          </label>
        </div>
        {/* إعدادات الطلبات (القسم 7.5) */}
        <div className="border-t pt-3 space-y-3">
          <h4 className="font-bold text-sm">إعدادات الطلبات</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-gray-600">
              حد أدنى لقيمة الطلب (اختياري)
              <input
                type="number"
                className="border rounded-lg px-3 py-2.5 w-full mt-1"
                placeholder="مثال: 5000"
                value={form.minOrderTotal}
                onChange={(e) => setForm({ ...form, minOrderTotal: e.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-600">
              رسالة شكر بعد الطلب (اختياري)
              <input
                className="border rounded-lg px-3 py-2.5 w-full mt-1"
                placeholder="مثال: شكراً لثقتك — طلبك يوصلك بإذن الله"
                value={form.thankYouNote}
                onChange={(e) => setForm({ ...form, thankYouNote: e.target.value })}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.vacationMode}
              onChange={(e) => setForm({ ...form, vacationMode: e.target.checked })}
            />
            <span className="font-semibold">وضع الإجازة</span>
            <span className="text-gray-500 text-xs">— المتجر يظهر لكن استقبال الطلبات يتوقف مؤقتاً</span>
          </label>
          {form.vacationMode && (
            <input
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder="رسالة للزوار (مثال: في إجازة العيد — نعود السبت)"
              value={form.vacationMessage}
              onChange={(e) => setForm({ ...form, vacationMessage: e.target.value })}
            />
          )}
        </div>

        <button onClick={save} className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700">
          حفظ ✓
        </button>
        {msg && <div className="text-sm text-brand-700">{msg}</div>}
      </div>

      <div className="card p-4">
        <h3 className="font-bold mb-1">أسعار الشحن حسب المحافظة</h3>
        <p className="text-xs text-gray-500 mb-3">
          المحافظات غير المذكورة هنا تُحسب بالرسوم الافتراضية
        </p>
        <div className="space-y-2">
          {rates?.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-semibold">{r.governorate.nameAr}</span>
              <span className="text-brand-700 font-bold">{Number(r.fee).toLocaleString("ar-u-nu-latn")}</span>
              {r.etaText && <span className="text-gray-500 text-xs">({r.etaText})</span>}
              <button onClick={() => removeRate(r.id)} className="mr-auto text-gray-400 hover:text-red-500 font-bold">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <select
            className="border rounded-lg px-2 py-2 text-sm bg-white"
            value={rateForm.governorateId}
            onChange={(e) => setRateForm({ ...rateForm, governorateId: Number(e.target.value) })}
          >
            <option value={0}>المحافظة</option>
            {governorates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameAr}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="border rounded-lg px-2 py-2 text-sm"
            placeholder="الرسوم"
            value={rateForm.fee}
            onChange={(e) => setRateForm({ ...rateForm, fee: e.target.value })}
          />
          <input
            className="border rounded-lg px-2 py-2 text-sm"
            placeholder="المدة (2-3 أيام)"
            value={rateForm.etaText}
            onChange={(e) => setRateForm({ ...rateForm, etaText: e.target.value })}
          />
        </div>
        <button onClick={addRate} className="mt-2 w-full border border-brand-600 text-brand-700 rounded-lg py-2 text-sm font-bold hover:bg-brand-50">
          + أضف سعر شحن
        </button>
      </div>
    </div>
  );
}
