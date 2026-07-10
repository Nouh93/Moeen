"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Link2, Palette, Plus, Trash2 } from "lucide-react";
import { api, imgUrl, uploadFile } from "@/lib/api";

/** ألوان جاهزة منتقاة — تباين كافٍ مع نص أبيض */
const PRESETS = [
  "#404f97", // نيلي مُعين (الافتراضي)
  "#0e7490", // أزرق بحري
  "#047857", // أخضر عدني
  "#b45309", // نحاسي
  "#be123c", // قرمزي
  "#7c3aed", // بنفسجي
  "#a21caf", // أرجواني
  "#1f2937", // فحمي
];

type Banner = { imageUrl: string; link?: string };

/** تخصيص مظهر المتجر (القسم 5.4): لون، غلاف، بنرات، صفحات، تواصل */
export function Appearance({
  token,
  store,
  onSaved,
}: {
  token: string;
  store: any;
  onSaved: () => void;
}) {
  const [themeColor, setThemeColor] = useState<string>(store.themeColor ?? "");
  const [coverUrl, setCoverUrl] = useState<string>(store.coverUrl ?? "");
  const [banners, setBanners] = useState<Banner[]>(
    Array.isArray(store.banners) ? store.banners : [],
  );
  const [aboutText, setAboutText] = useState<string>(store.aboutText ?? "");
  const [returnPolicy, setReturnPolicy] = useState<string>(store.returnPolicy ?? "");
  const [social, setSocial] = useState<Record<string, string>>({
    instagram: store.socialLinks?.instagram ?? "",
    facebook: store.socialLinks?.facebook ?? "",
    tiktok: store.socialLinks?.tiktok ?? "",
    x: store.socialLinks?.x ?? "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function pick(file: File, set: (url: string) => void) {
    setBusy(true);
    setMsg("");
    try {
      set(await uploadFile(file, token));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setMsg("");
    try {
      const socialLinks = Object.fromEntries(
        Object.entries(social).filter(([, v]) => v.trim()),
      );
      await api(`/stores/${store.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          themeColor: themeColor || null,
          coverUrl: coverUrl || null,
          banners,
          aboutText: aboutText.trim() || null,
          returnPolicy: returnPolicy.trim() || null,
          socialLinks,
        }),
      });
      setMsg("حُفظ المظهر ✓ — افتح متجرك وشاهد الفرق");
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="card p-4 space-y-4 lg:col-span-2">
      <h3 className="font-bold flex items-center gap-2">
        <Palette size={17} className="text-brand-600" /> مظهر المتجر
      </h3>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          {/* لون المتجر */}
          <div>
            <div className="text-sm text-gray-600 mb-2">لون متجرك — يصبغ الواجهة والأزرار</div>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setThemeColor(c === PRESETS[0] ? "" : c)}
                  style={{ backgroundColor: c }}
                  title={c}
                  className={`w-8 h-8 rounded-full border-2 ${
                    themeColor === c || (!themeColor && c === PRESETS[0])
                      ? "border-brand-950 ring-2 ring-brand-300"
                      : "border-white shadow"
                  }`}
                />
              ))}
              <label className="text-xs text-gray-500 inline-flex items-center gap-1.5 cursor-pointer border rounded-full px-3 py-1.5 hover:bg-gray-50">
                لون آخر
                <input
                  type="color"
                  value={themeColor || PRESETS[0]}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* صورة الغلاف */}
          <div>
            <div className="text-sm text-gray-600 mb-2">صورة الغلاف (تظهر أعلى المتجر — يفضَّل 1200×400)</div>
            {coverUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(coverUrl)} alt="" className="w-full aspect-[3/1] object-cover rounded-xl" />
                <button
                  onClick={() => setCoverUrl("")}
                  className="absolute top-2 left-2 bg-white/90 text-red-600 rounded-lg p-1.5 hover:bg-white"
                  title="إزالة الغلاف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverRef.current?.click()}
                disabled={busy}
                className="w-full aspect-[4/1] border-2 border-dashed rounded-xl text-gray-400 hover:border-brand-400 hover:text-brand-600 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
              >
                <ImageIcon size={17} /> {busy ? "جارٍ الرفع..." : "ارفع صورة غلاف"}
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], setCoverUrl)}
            />
          </div>

          {/* البنرات */}
          <div>
            <div className="text-sm text-gray-600 mb-2">بنرات ترويجية (حتى 5 — تظهر تحت الغلاف)</div>
            <div className="space-y-2">
              {banners.map((b, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(b.imageUrl)} alt="" className="w-20 h-12 object-cover rounded-md shrink-0" />
                  <div className="relative flex-1">
                    <Link2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="border rounded-lg pr-8 pl-2 py-1.5 text-xs w-full"
                      dir="ltr"
                      placeholder="رابط عند الضغط (اختياري)"
                      value={b.link ?? ""}
                      onChange={(e) =>
                        setBanners(banners.map((x, j) => (j === i ? { ...x, link: e.target.value || undefined } : x)))
                      }
                    />
                  </div>
                  <button
                    onClick={() => setBanners(banners.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            {banners.length < 5 && (
              <button
                onClick={() => bannerRef.current?.click()}
                disabled={busy}
                className="mt-2 w-full border border-brand-600 text-brand-700 rounded-lg py-2 text-sm font-bold hover:bg-brand-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus size={15} /> {busy ? "جارٍ الرفع..." : "أضف بنراً"}
              </button>
            )}
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] &&
                pick(e.target.files[0], (url) => setBanners((bs) => [...bs, { imageUrl: url }]))
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-gray-600">
            عن المتجر (يظهر في تذييل متجرك)
            <textarea
              className="border rounded-lg px-3 py-2.5 w-full mt-1"
              rows={3}
              placeholder="قصة متجرك، تخصصك، منذ متى تعمل..."
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
            />
          </label>
          <label className="block text-sm text-gray-600">
            سياسة الاستبدال والإرجاع
            <textarea
              className="border rounded-lg px-3 py-2.5 w-full mt-1"
              rows={3}
              placeholder="مثال: الاستبدال خلال 3 أيام بحالة المنتج الأصلية..."
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
            />
          </label>
          <div>
            <div className="text-sm text-gray-600 mb-2">حسابات التواصل (اسم المستخدم أو الرابط)</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["instagram", "إنستغرام"],
                  ["facebook", "فيسبوك"],
                  ["tiktok", "تيك توك"],
                  ["x", "إكس (تويتر)"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  className="border rounded-lg px-3 py-2 text-sm"
                  dir="ltr"
                  placeholder={label}
                  value={social[key]}
                  onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700">
          حفظ المظهر ✓
        </button>
        {msg && <div className="text-sm text-brand-700">{msg}</div>}
      </div>
    </div>
  );
}
