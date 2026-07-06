"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Star } from "lucide-react";
import { api } from "@/lib/api";

/** تقييمات التاجر (القسم 13): يرد علناً ولا يحذف — يبلّغ والمنصة تحكم */
export function Reviews({ token, store }: { token: string; store: any }) {
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = useCallback(() => {
    api<any[]>(`/stores/${store.id}/reviews`, { token }).then(setReviews).catch(() => {});
  }, [token, store.id]);
  useEffect(load, [load]);

  async function sendReply(id: string) {
    if (!replyText.trim()) return;
    await api(`/stores/${store.id}/reviews/${id}/reply`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ reply: replyText }),
    });
    setReplyFor(null);
    setReplyText("");
    load();
  }

  async function report(id: string) {
    await api(`/stores/${store.id}/reviews/${id}/report`, { method: "PATCH", token });
    load();
  }

  if (!reviews) return <div className="text-gray-500">جارٍ التحميل...</div>;
  if (reviews.length === 0)
    return (
      <div className="text-center text-gray-500 py-16">
        لا تقييمات بعد — تصل تلقائياً بعد استلام العملاء طلباتهم
      </div>
    );

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{r.customerName}</span>
            <span className="flex" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  className={n <= r.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}
                />
              ))}
            </span>
            {r.status === "REPORTED" && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">مبلَّغ — قيد مراجعة الإدارة</span>
            )}
            {r.status === "HIDDEN" && (
              <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">أخفته الإدارة</span>
            )}
            <span className="text-xs text-gray-400 mr-auto" dir="ltr">
              {new Date(r.createdAt).toLocaleDateString("ar-u-nu-latn")}
            </span>
          </div>
          {r.comment && <p className="text-sm text-gray-700 mt-2">"{r.comment}"</p>}
          {r.reply ? (
            <div className="mt-2 bg-brand-50 rounded-lg p-2.5 text-sm">
              <b className="text-brand-800">ردك:</b> {r.reply}
            </div>
          ) : replyFor === r.id ? (
            <div className="mt-2 flex gap-2">
              <input
                className="border rounded-lg px-3 py-1.5 flex-1 text-sm"
                placeholder="رد ودّي علني..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply(r.id)}
              />
              <button onClick={() => sendReply(r.id)} className="bg-brand-600 text-white rounded-lg px-4 text-sm font-bold">
                أرسل
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setReplyFor(r.id)}
                className="text-xs border rounded-lg px-3 py-1.5 font-semibold hover:bg-gray-50"
              >
                رد علني
              </button>
              {r.status === "VISIBLE" && (
                <button
                  onClick={() => report(r.id)}
                  className="text-xs border rounded-lg px-3 py-1.5 font-semibold hover:bg-gray-50 text-gray-500 inline-flex items-center gap-1"
                >
                  <Flag size={11} /> تبليغ (مسيء)
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
