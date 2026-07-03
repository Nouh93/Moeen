export * from "./yemen-data";

/** حالات الطلب — القسم 7.1 من الوثيقة الرئيسية */
export const ORDER_STATUSES = [
  "NEW",
  "PROCESSING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  NEW: "جديد — قيد المراجعة",
  PROCESSING: "قيد التجهيز",
  OUT_FOR_DELIVERY: "مع المندوب",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
};

/** الانتقالات المسموحة بين حالات الطلب */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

/** عملات التسعير — القسم 7.4 (انقسام الريال) */
export const CURRENCIES = ["YER_SANAA", "YER_ADEN", "USD", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_AR: Record<Currency, string> = {
  YER_SANAA: "ريال يمني (صنعاء)",
  YER_ADEN: "ريال يمني (عدن)",
  USD: "دولار أمريكي",
  SAR: "ريال سعودي",
};

/** طرق الدفع — القسم 7.2. المرحلة 1: COD فقط، والبقية تُفعَّل في المرحلة 2 */
export const PAYMENT_METHODS = ["COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_AR: Record<PaymentMethod, string> = {
  COD: "الدفع عند الاستلام",
};

/** التحقق من رقم جوال يمني (+967 أو محلي يبدأ بـ 7) */
export function normalizeYemeniPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  const m = digits.match(/^(?:\+?967)?(7[0-9]{8})$/);
  return m ? `+967${m[1]}` : null;
}
