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

/**
 * الباقات (القسم 3 من الوثيقة الرئيسية).
 * الأسعار بالريال اليمني — قيم مبدئية تُعتمد نهائياً بعد الاختبار السعري.
 * الدفع السنوي = 12 شهراً بسعر 10 (شهران مجاناً — القسم 24.3 بالملحق).
 */
export const PLANS = {
  FREE: {
    nameAr: "بداية",
    monthlyPrice: 0,
    maxProducts: 20,
    maxOrdersPerMonth: 30,
    coupons: false,
    features: ["20 منتجاً", "30 طلباً شهرياً", "إشعارات واتساب أساسية", "رابط متجر على مُعين"],
  },
  GROWTH: {
    nameAr: "نمو",
    monthlyPrice: 8000,
    maxProducts: Infinity,
    maxOrdersPerMonth: Infinity,
    coupons: true,
    features: ["منتجات وطلبات بلا حدود", "كوبونات وعروض", "إشعارات واتساب كاملة", "تقارير متقدمة"],
  },
  PRO: {
    nameAr: "احتراف",
    monthlyPrice: 20000,
    maxProducts: Infinity,
    maxOrdersPerMonth: Infinity,
    coupons: true,
    features: ["كل مزايا نمو", "دومين خاص (قريباً)", "API و Webhooks (قريباً)", "أولوية في الدعم"],
  },
} as const;
export type PlanId = keyof typeof PLANS;

export const YEARLY_MONTHS_CHARGED = 10; // ادفع 10 واحصل على 12

export function planPrice(plan: PlanId, months: 1 | 12): number {
  const monthly = PLANS[plan].monthlyPrice;
  return months === 12 ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** دورة الإنذار — القسم 24.4 بالملحق (أيام منذ الاستحقاق) */
export const DUNNING = {
  REMINDER_1: 7,
  REMINDER_2: 10,
  SUSPEND: 15,
  FINAL_NOTICE: 30,
  CLOSE: 37,
  /** تاجر جديد: أول شهرين لا تعليق (القسم 24.5) */
  NEW_MERCHANT_PROTECTION_DAYS: 60,
} as const;

/**
 * التحقق من رقم الجوال وتطبيعه.
 * الأساس: أرقام يمنية (+967 أو محلي يبدأ بـ 7).
 * ويُقبل بالصيغة الدولية الكاملة: سعودي (+9665...) وقطري (+974...) —
 * لأصحاب المنصة والمغتربين الذين يديرون متاجرهم من الخارج.
 */
export function normalizeYemeniPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  const yemeni = digits.match(/^(?:\+?967)?(7[0-9]{8})$/);
  if (yemeni) return `+967${yemeni[1]}`;
  const saudi = digits.match(/^\+?966(5[0-9]{8})$/);
  if (saudi) return `+966${saudi[1]}`;
  const qatari = digits.match(/^\+?974([0-9]{8})$/);
  if (qatari) return `+974${qatari[1]}`;
  return null;
}
