"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Images, Pencil, Plus, X } from "lucide-react";
import { api, formatPrice, imgUrl, uploadFile } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  compareAtPrice: "",
  imageUrl: "",
  images: [] as string[],
  trackStock: false,
  featured: false,
  stock: "0",
  categoryId: "",
  variants: [] as { id?: string; name: string; price: string; stock: string }[],
};

export function Products({ token, store }: { token: string; store: any }) {
  const [products, setProducts] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<any | null>(null); // null=مغلق، {}=جديد، منتج=تعديل
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/products`, { token }).then(setProducts).catch((e) => setError(e.message));
    api<any[]>(`/stores/${store.id}/categories`, { token }).then(setCategories).catch(() => {});
  }, [token, store.id]);

  useEffect(load, [load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing({});
  }

  function openEdit(p: any) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
      imageUrl: p.imageUrl ?? "",
      images: (p.images as string[]) ?? [],
      trackStock: p.trackStock,
      featured: !!p.featured,
      stock: String(p.stock),
      categoryId: p.categoryId ?? "",
      variants: (p.variants ?? []).map((v: any) => ({
        id: v.id,
        name: v.name,
        price: v.price ? String(v.price) : "",
        stock: String(v.stock),
      })),
    });
    setEditing(p);
  }

  async function pickImage(file: File) {
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file, token);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name || !form.price) {
      setError("الاسم والسعر مطلوبان");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      imageUrl: form.imageUrl || undefined,
      images: form.images,
      trackStock: form.trackStock,
      featured: form.featured,
      stock: Number(form.stock) || 0,
      categoryId: form.categoryId || undefined,
      variants: form.variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          id: v.id,
          name: v.name.trim(),
          price: v.price ? Number(v.price) : undefined,
          stock: Number(v.stock) || 0,
        })),
    };
    try {
      if (editing?.id) {
        await api(`/stores/${store.id}/products/${editing.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/stores/${store.id}/products`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: any) {
    await api(`/stores/${store.id}/products/${p.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status: p.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" }),
    });
    load();
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    await api(`/stores/${store.id}/categories`, {
      method: "POST",
      token,
      body: JSON.stringify({ name: newCategory }),
    });
    setNewCategory("");
    load();
  }

  async function removeCategory(id: string) {
    await api(`/stores/${store.id}/categories/${id}`, { method: "DELETE", token });
    load();
  }

  if (!products) return <div className="text-gray-500">جارٍ التحميل...</div>;

  return (
    <div>
      {/* التصنيفات */}
      <div className="card p-4 mb-4">
        <h3 className="font-bold text-sm mb-2">التصنيفات</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {categories.map((c) => (
            <span key={c.id} className="bg-gray-100 rounded-full px-3 py-1 text-sm flex items-center gap-1.5">
              {c.name}
              <span className="text-gray-400 text-xs">({c._count?.products ?? 0})</span>
              <button onClick={() => removeCategory(c.id)} className="text-gray-400 hover:text-red-500 font-bold">
                ×
              </button>
            </span>
          ))}
          <input
            className="border rounded-lg px-3 py-1 text-sm w-36"
            placeholder="تصنيف جديد"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button onClick={addCategory} className="text-brand-600 font-bold text-sm">
            + إضافة
          </button>
        </div>
      </div>

      <button onClick={openNew} className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700 inline-flex items-center gap-1.5">
        <Plus size={18} /> أضف منتجاً
      </button>

      {/* نموذج إضافة/تعديل */}
      {editing !== null && (
        <div className="card border-2 border-brand-500 p-4 mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">{editing.id ? "تعديل المنتج" : "منتج جديد"}</h3>
            <button onClick={() => setEditing(null)} className="text-gray-400 font-bold text-xl">
              ×
            </button>
          </div>
          <input
            className="border rounded-lg px-3 py-2.5 w-full"
            placeholder="اسم المنتج *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className="border rounded-lg px-3 py-2.5 w-full"
            rows={2}
            placeholder="الوصف"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder="السعر *"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              type="number"
              className="border rounded-lg px-3 py-2.5 w-full"
              placeholder="السعر قبل الخصم"
              value={form.compareAtPrice}
              onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2.5 w-full bg-white"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">بدون تصنيف</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* صورة المنتج: رفع من الجهاز */}
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-3xl overflow-hidden shrink-0">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl(form.imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="border rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                {uploading ? "جارٍ الرفع..." : (<span className="inline-flex items-center gap-1.5"><Camera size={15} /> {form.imageUrl ? "غيّر الصورة" : "ارفع صورة"}</span>)}
              </button>
              {form.imageUrl && (
                <button onClick={() => setForm({ ...form, imageUrl: "" })} className="text-red-500 text-sm mr-3">
                  حذف
                </button>
              )}
            </div>
          </div>

          {/* صور إضافية — حتى 10 صور (القسم 5.2) */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Images size={13} /> صور إضافية ({form.images.length}/9)
            </div>
            <div className="flex gap-2 flex-wrap">
              {form.images.map((url, i) => (
                <div key={url} className="relative w-16 h-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(url)} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                    className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {form.images.length < 9 && (
                <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:border-brand-400">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 9 - form.images.length);
                      setUploading(true);
                      try {
                        const urls: string[] = [];
                        for (const f of files) urls.push(await uploadFile(f, token));
                        setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  <Plus size={20} />
                </label>
              )}
            </div>
          </div>

          {/* خيارات المنتج: مقاس/لون بسعر ومخزون مستقلين (القسم 5.1) */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">
              خيارات المنتج (مقاس / لون...) — اتركها فارغة إن لم يكن للمنتج خيارات
            </div>
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="border rounded-lg px-2 py-1.5 text-sm flex-1"
                    placeholder="الخيار (مثال: أحمر / L)"
                    value={v.name}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, name: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                  <input
                    type="number"
                    className="border rounded-lg px-2 py-1.5 text-sm w-28"
                    placeholder="سعر خاص"
                    value={v.price}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, price: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                  <input
                    type="number"
                    className="border rounded-lg px-2 py-1.5 text-sm w-20"
                    placeholder="الكمية"
                    value={v.stock}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, stock: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                  <button
                    onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm({ ...form, variants: [...form.variants, { name: "", price: "", stock: "0" }] })
                }
                className="text-brand-600 text-xs font-bold"
              >
                + أضف خياراً
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.trackStock}
                onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
              />
              تتبّع المخزون
            </label>
            {form.trackStock && (
              <input
                type="number"
                className="border rounded-lg px-3 py-1.5 w-24"
                placeholder="الكمية"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              منتج مميز ⭐ (يتصدّر واجهة المتجر)
            </label>
          </div>
          <button
            onClick={save}
            disabled={busy || uploading}
            className="w-full bg-brand-600 text-white rounded-xl py-2.5 font-bold hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "جارٍ الحفظ..." : "حفظ ✓"}
          </button>
        </div>
      )}

      {error && <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="mt-4 space-y-2">
        {products.map((p) => (
          <div key={p.id} className="card p-3 flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0 overflow-hidden">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl(p.imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {p.featured && <span title="منتج مميز">⭐ </span>}
                {p.name}
                {p.category && (
                  <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 mr-2">{p.category.name}</span>
                )}
              </div>
              <div className="text-brand-700 font-bold text-sm">
                {formatPrice(p.price, store.currency)}
                {p.trackStock && (
                  <span className={`font-normal ${p.stock <= 3 ? "text-red-500" : "text-gray-500"}`}> · مخزون: {p.stock}</span>
                )}
              </div>
            </div>
            <button onClick={() => openEdit(p)} className="text-xs rounded-lg px-3 py-1.5 font-semibold border hover:bg-gray-50 inline-flex items-center gap-1">
              <Pencil size={12} /> تعديل
            </button>
            <button
              onClick={() => toggle(p)}
              className={`text-xs rounded-lg px-3 py-1.5 font-semibold ${
                p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              }`}
            >
              {p.status === "ACTIVE" ? "ظاهر ✓" : "مخفي"}
            </button>
          </div>
        ))}
        {products.length === 0 && editing === null && (
          <div className="text-center text-gray-500 py-10">أضف أول منتج ليظهر متجرك للعملاء</div>
        )}
      </div>
    </div>
  );
}
