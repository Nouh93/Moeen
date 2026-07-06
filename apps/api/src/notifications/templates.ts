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

  // ---- رسائل الفوترة (القسمان 24.4 و 26.2.4 بالملحق) ----

  /** فاتورة جديدة مع المرجع وطرق السداد */
  INVOICE_ISSUED: (merchantName: string, amount: string, reference: string, url: string) =>
    `مرحباً ${merchantName} 👋\n` +
    `اشتراكك يستحق التجديد.\n` +
    `💰 قيمة الاشتراك: ${amount}\n` +
    `🔖 مرجع السداد: ${reference}\n` +
    `ادفع من أي محفظة (جوالي، ONE Cash، فلوسك…) عبر "دفع فاتورة" بكود مُعين + المرجع أعلاه، ` +
    `وسيتفعّل اشتراكك تلقائياً خلال لحظات.\n${url}`,

  /** تذكير السداد (يوم 7 و10) */
  SUBSCRIPTION_REMINDER: (merchantName: string, amount: string, reference: string, daysLeft: number) =>
    `مرحباً ${merchantName} 👋\n` +
    `اشتراكك يستحق السداد — ${daysLeft > 0 ? `باقي ${daysLeft} أيام قبل تعليق المتجر` : "سدّده اليوم ليبقى متجرك ظاهراً"}.\n` +
    `💰 ${amount} — 🔖 المرجع: ${reference}`,

  /** تعليق المتجر (يوم 15) — بلغة لا تُخيف (القسم 26.1) */
  STORE_SUSPENDED: (merchantName: string, amount: string, reference: string) =>
    `مرحباً ${merchantName}،\n` +
    `عُلّق متجرك مؤقتاً عن الزوار لتأخر السداد — لوحة تحكمك تعمل وبياناتك بأمان تام.\n` +
    `سدّد الآن ويعود متجرك فوراً وبشكل تلقائي:\n` +
    `💰 ${amount} — 🔖 المرجع: ${reference}`,

  /** استلام الدفعة والتفعيل الآلي */
  PAYMENT_RECEIVED: (merchantName: string, amount: string, until: string) =>
    `أهلاً ${merchantName} 🎉\n` +
    `وصل سدادك (${amount}) وتفعّل اشتراكك تلقائياً.\n` +
    `اشتراكك ساري حتى ${until}. شكراً لثقتك! 🙏`,

  /** شحن المحفظة */
  WALLET_TOPUP: (merchantName: string, amount: string, balance: string) =>
    `أهلاً ${merchantName} 👋\n` +
    `شُحنت محفظتك بمبلغ ${amount}.\n` +
    `رصيدك الحالي: ${balance} — يُخصم منه اشتراكك تلقائياً كل دورة.`,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
