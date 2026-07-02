import type { PaymentEvent } from "../billing/reconciliation.service.js";

/**
 * منفذ بوابة الدفع (Port). كل مزوّد (MEPS، eSadad/WeNet، محفظة…) يُنفَّذ كـ
 * adapter يحقّق هذا العقد، فيُعزَل منطق المطابقة عن تفاصيل كل مزوّد.
 */
export interface PaymentGateway {
  /** مصدر الدفع المقابل لهذا المزوّد (لتدوينه في السجل). */
  readonly source: PaymentEvent["source"];

  /** هل المزوّد مُهيَّأ (مفتاح/سرّ متوفّر)؟ */
  readonly configured: boolean;

  /** يتحقّق من توقيع الـwebhook على الجسم الخام (يمنع التزوير). */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;

  /** يحوّل حمولة المزوّد إلى حدث دفع موحّد للمحرّك. */
  normalize(payload: unknown): PaymentEvent;
}
