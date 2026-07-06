"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Upload } from "lucide-react";
import { api, uploadFile } from "@/lib/api";

const STATUS_AR: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "قيد المراجعة — نرد خلال 24 ساعة", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "معتمد ✓", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
};

/** توثيق المتجر — جانب التاجر (القسم 4.3) */
export function KycSection({ token, store }: { token: string; store: any }) {
  const [data, setData] = useState<any>(null);
  const [files, setFiles] = useState<{ idImageUrl?: string; selfieUrl?: string; proofUrl?: string }>({});
  const [uploading, setUploading] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = {
    idImageUrl: useRef<HTMLInputElement>(null),
    selfieUrl: useRef<HTMLInputElement>(null),
    proofUrl: useRef<HTMLInputElement>(null),
  };

  const load = useCallback(() => {
    api(`/stores/${store.id}/kyc`, { token }).then(setData).catch(() => {});
  }, [token, store.id]);
  useEffect(load, [load]);

  async function pick(field: keyof typeof refs, file: File) {
    setUploading(field);
    try {
      const url = await uploadFile(file, token);
      setFiles((f) => ({ ...f, [field]: url }));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setUploading("");
    }
  }

  async function submit(level: 1 | 2) {
    if (!files.idImageUrl) {
      setMsg("ارفع صورة الهوية أولاً");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api(`/stores/${store.id}/kyc`, {
        method: "POST",
        token,
        body: JSON.stringify({ level, ...files }),
      });
      setMsg("أُرسل طلبك — نراجعه خلال 24 ساعة كحد أقصى ✓");
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const kycLevel = data.kycLevel ?? 0;
  const latest = data.latest;
  const pending = latest?.status === "PENDING";

  const uploadBtn = (field: keyof typeof refs, label: string) => (
    <div>
      <input
        ref={refs[field]}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pick(field, e.target.files[0])}
      />
      <button
        onClick={() => refs[field].current?.click()}
        disabled={!!uploading}
        className={`border rounded-lg px-3 py-2 text-xs font-semibold hover:bg-gray-50 inline-flex items-center gap-1.5 ${
          files[field] ? "border-green-400 text-green-700" : ""
        }`}
      >
        <Upload size={13} />
        {uploading === field ? "جارٍ الرفع..." : files[field] ? `${label} ✓` : label}
      </button>
    </div>
  );

  return (
    <div className="card p-4 lg:col-span-2">
      <h3 className="font-bold flex items-center gap-2">
        <BadgeCheck size={18} className={kycLevel >= 1 ? "text-green-600" : "text-gray-400"} />
        توثيق المتجر
        {kycLevel >= 1 && (
          <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1">
            هوية موثّقة — مستوى {kycLevel} ✓
          </span>
        )}
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        التوثيق يظهر شارة «هوية موثّقة» في متجرك ويزيد ثقة العملاء — ومستوى 2 يفتح لك الدفع الإلكتروني لاحقاً.
      </p>

      {pending ? (
        <div className={`mt-3 text-sm rounded-lg p-3 ${STATUS_AR.PENDING.cls}`}>
          طلبك (مستوى {latest.level}) {STATUS_AR.PENDING.label}
        </div>
      ) : (
        <>
          {latest?.status === "REJECTED" && (
            <div className="mt-3 text-sm bg-red-50 text-red-700 rounded-lg p-3">
              رُفض طلبك السابق — السبب: {latest.adminNote}. عدّل وأعد الإرسال.
            </div>
          )}
          {kycLevel < 2 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {uploadBtn("idImageUrl", "صورة الهوية / الجواز")}
              {uploadBtn("selfieUrl", "سيلفي مع الهوية")}
              {kycLevel >= 1 && uploadBtn("proofUrl", "سجل تجاري / صور المحل")}
              <div className="flex gap-2 mr-auto">
                {kycLevel < 1 && (
                  <button
                    onClick={() => submit(1)}
                    disabled={busy}
                    className="bg-brand-600 text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-brand-700 disabled:opacity-60"
                  >
                    وثّق هويتي (مستوى 1)
                  </button>
                )}
                {kycLevel === 1 && (
                  <button
                    onClick={() => submit(2)}
                    disabled={busy}
                    className="bg-brand-600 text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-brand-700 disabled:opacity-60"
                  >
                    وثّق نشاطي (مستوى 2)
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {msg && <div className="mt-2 text-sm text-brand-700">{msg}</div>}
    </div>
  );
}
