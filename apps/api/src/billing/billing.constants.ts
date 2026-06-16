/** مرجع الفاتورة الفريد لمحرّك المطابقة: MOEEN-<معرّف التاجر>-<YYYYMM>. */
export function invoiceReference(merchantId: string, period: Date): string {
  const ym = `${period.getUTCFullYear()}${String(period.getUTCMonth() + 1).padStart(2, "0")}`;
  return `MOEEN-${merchantId}-${ym}`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** جدول الإنذار (PRD 24.4) محسوباً بالأيام منذ إصدار الفاتورة. */
export const Dunning = {
  REMINDER_1_DAY: 7,
  REMINDER_2_DAY: 10,
  SUSPEND_DAY: 15,
  FINAL_NOTICE_DAY: 30,
  CLOSE_DAY: 37,
  /** إعفاء التاجر الجديد من التعليق أول شهرين (PRD 24.5). */
  NEW_MERCHANT_GRACE_DAYS: 60,
} as const;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}
