/**
 * قوالب رسائل واتساب — بالأسلوب اليمني المعتمد (القسم 26.2 بالملحق):
 * عربية واضحة، دافئة، موجزة، إيجابية حتى في الأخطاء.
 */
import { ORDER_STATUS_AR } from "@moeen/shared";

interface OrderLike {
  code: string;
  customerName: string;
  total: unknown;
  currency: string;
  status: string;
  items: { name: string; quantity: number }[];
}

const CURRENCY_LABEL: Record<string, string> = {
  YER_SANAA: "ريال",
  YER_ADEN: "ريال (عدن)",
  USD: "دولار",
  SAR: "ريال سعودي",
};

function money(total: unknown, currency: string): string {
  return `${Number(total).toLocaleString("ar-YE")} ${CURRENCY_LABEL[currency] ?? ""}`.trim();
}

function itemsList(items: OrderLike["items"]): string {
  return items.map((i) => `• ${i.name} × ${i.quantity}`).join("\n");
}

export const TEMPLATES = {
  /** تأكيد الطلب للعميل — القسم 26.2.1 */
  ORDER_CONFIRMED_CUSTOMER: (o: OrderLike, storeName: string, trackUrl: string) =>
    `أهلاً ${o.customerName} 👋\n` +
    `وصل طلبك بنجاح من متجر ${storeName}!\n` +
    `📦 المنتجات:\n${itemsList(o.items)}\n` +
    `💰 الإجمالي: ${money(o.total, o.currency)} — تدفعه عند الاستلام\n` +
    `🔎 تتبّع طلبك: ${trackUrl}\n` +
    `سنُرسِل لك تحديثاً عند خروج طلبك. شكراً لثقتك! 🙏`,

  /** إشعار التاجر بطلب جديد */
  NEW_ORDER_MERCHANT: (o: OrderLike, dashboardUrl: string) =>
    `طلب جديد 🎉\n` +
    `رقم الطلب: ${o.code}\n` +
    `${itemsList(o.items)}\n` +
    `💰 ${money(o.total, o.currency)}\n` +
    `ادخل لوحة التحكم لتأكيده: ${dashboardUrl}`,

  /** تحديث حالة الطلب للعميل — القسم 7.1 */
  ORDER_STATUS_CUSTOMER: (o: OrderLike, storeName: string, trackUrl: string) => {
    const lines: Record<string, string> = {
      PROCESSING: `طلبك قيد التجهيز الآن 📦`,
      OUT_FOR_DELIVERY: `طلبك خرج مع المندوب 🛵 — جهّز المبلغ ${money(o.total, o.currency)}`,
      DELIVERED: `وصل طلبك! 🎉 نتمنى أن ينال إعجابك — نسعد بتقييمك`,
      CANCELLED: `أُلغي طلبك ${o.code}. إذا كان عندك استفسار تواصل معنا مباشرة`,
      RETURNED: `سُجّل طلبك ${o.code} كمرتجع. تواصل معنا لأي استفسار`,
    };
    return (
      `مرحباً ${o.customerName} 👋\n` +
      `${lines[o.status] ?? `حالة طلبك الآن: ${ORDER_STATUS_AR[o.status as keyof typeof ORDER_STATUS_AR]}`}\n` +
      `من متجر ${storeName} — ${trackUrl}`
    );
  },

  /** تنبيه نقص المخزون للتاجر — القسم 26.2.3 */
  LOW_STOCK_MERCHANT: (productName: string, stock: number, url: string) =>
    `تنبيه مخزون 📦\n${productName} — تبقى ${stock} قطع فقط!\nادخل لتحديث المخزون: ${url}`,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
