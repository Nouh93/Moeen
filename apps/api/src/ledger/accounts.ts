/**
 * أكواد حسابات دفتر الأستاذ — مصدر موحّد لتفادي الأخطاء الإملائية في الأكواد.
 *
 * حسابات لكل تاجر (التزامات على المنصة تجاه التاجر):
 *  - wallet:merchant:<id>      رصيد مدفوع مسبقاً (Prepaid).
 *  - settlement:merchant:<id>  مدفوعات مُحصّلة نيابةً عنه (Settlement).
 *  - hold:merchant:<id>        مبالغ محجوزة (شحن قيد التنفيذ) — لا تُصرف ولا تُسوّى.
 *
 * حسابات المنصة العامة:
 *  - cash / cod-clearing       نقد وارد إلكترونياً / نقد COD لدى شركة الشحن (أصول).
 *  - payable:carrier           مستحقّ لشركة الشحن (التزام).
 *  - payable:acquirer          مستحقّ للمُستحوِذ (رسوم البوابة) (التزام).
 *  - revenue:commission        عمولة المنصة على البيع (دخل).
 *  - revenue:collection         عمولة تحصيل COD (دخل).
 *  - expense:mdr               مصروف رسوم البوابة (مصروف).
 */
export const PlatformAccounts = {
  CASH: "cash",
  COD_CLEARING: "cod-clearing",
  PAYABLE_CARRIER: "payable:carrier",
  PAYABLE_ACQUIRER: "payable:acquirer",
  REVENUE_COMMISSION: "revenue:commission",
  REVENUE_COLLECTION: "revenue:collection",
  REVENUE_SUBSCRIPTION: "revenue:subscription",
  EXPENSE_MDR: "expense:mdr",
} as const;

export const merchantWallet = (id: string): string => `wallet:merchant:${id}`;
export const merchantSettlement = (id: string): string => `settlement:merchant:${id}`;
export const merchantHold = (id: string): string => `hold:merchant:${id}`;
