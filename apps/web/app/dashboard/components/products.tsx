"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatPrice, imgUrl, uploadFile } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  compareAtPrice: "",
  imageUrl: "",
  trackStock: false,
  stock: "0",
  categoryId: "",
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
      trackStock: p.trackStock,
      stock: String(p.stock),
      categoryId: p.categoryId ?? "",
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
      trackStock: form.trackStock,
      stock: Number(form.stock) || 0,
      categoryId: form.categoryId || undefined,
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

      <button onClick={openNew} className="bg-brand-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-brand-700">
        + أضف منتجاً
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
                "🛍️"
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
                {uploading ? "جارٍ الرفع..." : form.imageUrl ? "غيّر الصورة 📷" : "ارفع صورة 📷"}
              </button>
              {form.imageUrl && (
                <button onClick={() => setForm({ ...form, imageUrl: "" })} className="text-red-500 text-sm mr-3">
                  حذف
                </button>
              )}
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
                "🛍️"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
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
            <button onClick={() => openEdit(p)} className="text-xs rounded-lg px-3 py-1.5 font-semibold border hover:bg-gray-50">
              تعديل ✏️
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
          <div className="text-center text-gray-500 py-10">أضف أول منتج ليظهر متجرك للعملاء 🛍️</div>
        )}
      </div>
    </div>
  );
}
