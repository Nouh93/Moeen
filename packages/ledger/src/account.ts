/**
 * أنواع الحسابات في دفتر الأستاذ، وفق معادلة المحاسبة:
 *   الأصول = الالتزامات + حقوق الملكية   (Assets = Liabilities + Equity)
 *   والدخل والمصروف يغذّيان حقوق الملكية.
 *
 * "الجانب الطبيعي" (normal side) لكل نوع يحدّد أي اتجاه (مدين/دائن) يزيد رصيده.
 */
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type Side = "DEBIT" | "CREDIT";

/** الجانب الذي يزيد رصيد الحساب. */
export function normalSide(type: AccountType): Side {
  switch (type) {
    case "ASSET":
    case "EXPENSE":
      return "DEBIT";
    case "LIABILITY":
    case "EQUITY":
    case "REVENUE":
      return "CREDIT";
  }
}

export interface AccountSpec {
  /** معرّف فريد للحساب (مثل: wallet:merchant:123). */
  readonly id: string;
  readonly type: AccountType;
  readonly currency: string;
  /**
   * هل يُسمح لرصيد هذا الحساب بالنزول تحت الصفر؟
   * افتراضياً false — تطبيقاً لقاعدة "لا رصيد سالب (الحد = 0)" في الـPRD.
   * حسابات المقاصّة/البنك (ASSET) قد تحتاجه true حسب التصميم.
   */
  readonly allowNegative?: boolean;
}
