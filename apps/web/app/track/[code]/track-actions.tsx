"use client";

import { useState } from "react";
import { CircleAlert, Star } from "lucide-react";
import { api } from "@/lib/api";

/**
 * إجراءات العميل في صفحة التتبع:
 * تقييم بعد التسليم (القسم 13) + فتح نزاع للطلبات المتعثرة (القسم 25.2)
 */
export function TrackActions({ order }: { order: any }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "dispute-done">("idle");
  const [error, setError] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  async function submitReview() {
    if (!rating) {
      setError("اختر عدد النجوم أولاً");
      return;
    }
    setState("busy");
    setError("");
    try {
      await api(`/public/orders/${order.code}/review`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      setState("done");
    } catch (e: any) {
      setError(e.message);
      setState("idle");
    }
  }

  async function submitDispute() {
    if (!disputeReason.trim()) {
      setError("اشرح مشكلتك باختصار");
      return;
    }
    setState("busy");
    setError("");
    try {
      await api(`/public/orders/${order.code}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason: disputeReason }),
      });
      setState("dispute-done");
    } catch (e: any) {
      setError(e.message);
      setState("idle");
    }
  }

  // تقييم — للطلبات المستلمة فقط وغير المقيّمة
  if (order.status === "DELIVERED") {
    if (order.hasReview || state === "done") {
      return (
        <div className="mt-5 bg-green-50 text-green-700 rounded-xl p-4 text-center text-sm font-semibold">
          شكراً لتقييمك — يساعد غيرك على الشراء بثقة 🙏
        </div>
      );
    }
    return (
      <div className="mt-5 border-t pt-4">
        <h2 className="font-bold text-sm text-gray-600 mb-2">وصل طلبك — قيّم تجربتك</h2>
        <div className="flex gap-1 justify-center" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="p-1">
              <Star
                size={30}
                className={n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}
              />
            </button>
          ))}
        </div>
        <textarea
          className="border rounded-xl px-3 py-2.5 w-full mt-3 text-sm"
          rows={2}
          placeholder="رأيك بالمنتج والخدمة (اختياري)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        <button
          onClick={submitReview}
          disabled={state === "busy"}
          className="mt-3 w-full bg-brand-600 text-white rounded-xl py-2.5 font-bold hover:bg-brand-700 disabled:opacity-60"
        >
          {state === "busy" ? "لحظات..." : "أرسل التقييم"}
        </button>
      </div>
    );
  }

  // نزاع — للطلبات الجارية
  if (["NEW", "PROCESSING", "OUT_FOR_DELIVERY"].includes(order.status)) {
    if (order.dispute || state === "dispute-done") {
      return (
        <div className="mt-5 bg-amber-50 text-amber-800 rounded-xl p-4 text-center text-sm">
          نزاعك قيد المراجعة — نرد خلال 48 ساعة كحد أقصى، وسيصلك القرار على واتساب
        </div>
      );
    }
    return (
      <div className="mt-5 border-t pt-4">
        {!showDispute ? (
          <button
            onClick={() => setShowDispute(true)}
            className="w-full text-sm text-gray-500 hover:text-amber-700 inline-flex items-center justify-center gap-1.5"
          >
            <CircleAlert size={15} /> عندك مشكلة في الطلب؟ افتح نزاعاً
          </button>
        ) : (
          <>
            <textarea
              className="border rounded-xl px-3 py-2.5 w-full text-sm"
              rows={2}
              placeholder="اشرح مشكلتك — مثال: تأخر الطلب كثيراً ولا أحد يرد"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            <button
              onClick={submitDispute}
              disabled={state === "busy"}
              className="mt-2 w-full border-2 border-amber-400 text-amber-700 rounded-xl py-2.5 font-bold hover:bg-amber-50 disabled:opacity-60"
            >
              {state === "busy" ? "لحظات..." : "فتح النزاع"}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              سيُبلَّغ المتجر فوراً — وإذا لم تُحل خلال 48 ساعة تتدخل إدارة مُعين
            </p>
          </>
        )}
      </div>
    );
  }

  return null;
}
