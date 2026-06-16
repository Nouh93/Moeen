/**
 * أخطاء النطاق المالي. كلها ترث من LedgerError ليسهل تمييزها وعدم خلطها
 * بأخطاء البرمجة العامة (programmer errors).
 */
export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** عملة غير معروفة أو عملية بين عملتين مختلفتين. */
export class CurrencyMismatchError extends LedgerError {}

/** قيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن. */
export class UnbalancedEntryError extends LedgerError {}

/** محاولة استخدام حساب غير مفتوح. */
export class UnknownAccountError extends LedgerError {}

/** خرق قاعدة الرصيد غير السالب (الحد = 0). */
export class InsufficientFundsError extends LedgerError {
  constructor(
    readonly accountId: string,
    readonly available: string,
    readonly requested: string,
  ) {
    super(
      `Insufficient funds in account "${accountId}": available ${available}, requested ${requested}`,
    );
  }
}

/** مبلغ غير صالح (سالب أو صفر حيث لا يُسمح). */
export class InvalidAmountError extends LedgerError {}
