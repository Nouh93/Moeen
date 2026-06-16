import { CurrencyMismatchError, InvalidAmountError, LedgerError } from "./errors.js";

/**
 * نموذج النقود.
 *
 * قاعدة حاكمة: لا نستخدم الأعداد العائمة (float) للمال أبداً — فهي تُنتج أخطاء
 * تقريب تتراكم وتُفسد المحاسبة. نخزّن كل مبلغ كـ **عدد صحيح من الوحدات الصغرى**
 * (minor units) باستخدام bigint، مع معامل قياس (scale) لكل عملة.
 *
 * مثال: 9,800 ريال يمني → amount = 9800n، scale = 0 (الريال اليمني بلا كسور عملياً).
 *        12.34 دولار → amount = 1234n، scale = 2.
 */
export interface Currency {
  /** رمز ISO 4217. */
  readonly code: string;
  /** عدد المنازل العشرية للوحدة الصغرى. */
  readonly scale: number;
}

export const CURRENCIES = {
  /** الريال اليمني — لا كسور متداولة عملياً → scale 0. */
  YER: { code: "YER", scale: 0 },
  USD: { code: "USD", scale: 2 },
  SAR: { code: "SAR", scale: 2 },
} as const satisfies Record<string, Currency>;

export type CurrencyCode = keyof typeof CURRENCIES;

export function getCurrency(code: string): Currency {
  const c = (CURRENCIES as Record<string, Currency>)[code];
  if (!c) throw new CurrencyMismatchError(`Unknown currency: ${code}`);
  return c;
}

/** اتجاه التقريب عند القسمة/الضرب بنِسَب. */
export type Rounding = "half-up" | "down";

export class Money {
  private constructor(
    /** المبلغ بالوحدات الصغرى (عدد صحيح). */
    readonly amount: bigint,
    readonly currency: Currency,
  ) {}

  /** يُنشئ مبلغاً من الوحدات الصغرى مباشرة (bigint أو رقم صحيح). */
  static ofMinor(minor: bigint | number, currencyCode: string): Money {
    const currency = getCurrency(currencyCode);
    const amount = typeof minor === "bigint" ? minor : BigInt(asInteger(minor));
    return new Money(amount, currency);
  }

  /** يُنشئ مبلغاً من الوحدة الكبرى (مثل 100 ريال) مع تطبيق القياس. */
  static ofMajor(major: number, currencyCode: string): Money {
    const currency = getCurrency(currencyCode);
    const factor = 10 ** currency.scale;
    const scaled = Math.round(asFinite(major) * factor);
    // نتحقق من عدم فقدان الدقة في حدود JS الآمنة.
    if (!Number.isSafeInteger(scaled)) {
      throw new InvalidAmountError(
        `Major amount ${major} ${currencyCode} exceeds safe integer range; use ofMinor with bigint.`,
      );
    }
    return new Money(BigInt(scaled), currency);
  }

  static zero(currencyCode: string): Money {
    return Money.ofMinor(0n, currencyCode);
  }

  private sameCurrency(other: Money): void {
    if (this.currency.code !== other.currency.code) {
      throw new CurrencyMismatchError(
        `Cannot operate on ${this.currency.code} and ${other.currency.code}`,
      );
    }
  }

  private withAmount(amount: bigint): Money {
    return new Money(amount, this.currency);
  }

  add(other: Money): Money {
    this.sameCurrency(other);
    return this.withAmount(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    this.sameCurrency(other);
    return this.withAmount(this.amount - other.amount);
  }

  negate(): Money {
    return this.withAmount(-this.amount);
  }

  abs(): Money {
    return this.amount < 0n ? this.negate() : this;
  }

  /** ضرب بنسبة (basis points آمنة) مع تقريب صريح. للعمولات مثلاً. */
  multiply(numerator: bigint | number, denominator: bigint | number, rounding: Rounding = "half-up"): Money {
    const n = typeof numerator === "bigint" ? numerator : BigInt(asInteger(numerator));
    const d = typeof denominator === "bigint" ? denominator : BigInt(asInteger(denominator));
    if (d === 0n) throw new LedgerError("Division by zero");
    const product = this.amount * n;
    return this.withAmount(divideRounded(product, d, rounding));
  }

  isZero(): boolean {
    return this.amount === 0n;
  }

  isNegative(): boolean {
    return this.amount < 0n;
  }

  isPositive(): boolean {
    return this.amount > 0n;
  }

  /** -1 | 0 | 1 */
  compare(other: Money): -1 | 0 | 1 {
    this.sameCurrency(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  equals(other: Money): boolean {
    return this.currency.code === other.currency.code && this.amount === other.amount;
  }

  /**
   * يقسّم المبلغ على عدّة حصص بأوزان، بحيث لا يضيع ولا يُخلَق ولا فلس واحد.
   * يوزّع باقي القسمة على الحصص الأولى (largest-remainder) لضمان الجمع == الأصل.
   */
  allocate(weights: number[]): Money[] {
    if (weights.length === 0) throw new InvalidAmountError("allocate requires at least one weight");
    if (weights.some((w) => w < 0)) throw new InvalidAmountError("weights must be non-negative");
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) throw new InvalidAmountError("weights must sum to a positive value");

    const totalBig = BigInt(total);
    const shares: bigint[] = [];
    let allocated = 0n;
    for (const w of weights) {
      const share = (this.amount * BigInt(w)) / totalBig; // floor
      shares.push(share);
      allocated += share;
    }
    // وزّع الباقي وحدة وحدة على الحصص ذات الأوزان الأكبر.
    let remainder = this.amount - allocated;
    const order = weights
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w)
      .map((x) => x.i);
    let k = 0;
    while (remainder > 0n) {
      const idx = order[k % order.length]!;
      shares[idx] = shares[idx]! + 1n;
      remainder -= 1n;
      k += 1;
    }
    return shares.map((s) => this.withAmount(s));
  }

  /** تمثيل نصي للوحدة الكبرى، للعرض/التدقيق فقط. */
  toString(): string {
    const negative = this.amount < 0n;
    const digits = (negative ? -this.amount : this.amount).toString();
    if (this.currency.scale === 0) {
      return `${negative ? "-" : ""}${digits} ${this.currency.code}`;
    }
    const padded = digits.padStart(this.currency.scale + 1, "0");
    const intPart = padded.slice(0, padded.length - this.currency.scale);
    const fracPart = padded.slice(padded.length - this.currency.scale);
    return `${negative ? "-" : ""}${intPart}.${fracPart} ${this.currency.code}`;
  }
}

function asInteger(n: number): number {
  if (!Number.isInteger(n)) {
    throw new InvalidAmountError(`Expected an integer, got ${n}`);
  }
  return n;
}

function asFinite(n: number): number {
  if (!Number.isFinite(n)) {
    throw new InvalidAmountError(`Expected a finite number, got ${n}`);
  }
  return n;
}

/** قسمة أعداد صحيحة (bigint) مع تقريب صريح تتعامل مع الإشارة بشكل صحيح. */
function divideRounded(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;
  const q = a / b;
  const r = a % b;
  let magnitude = q;
  if (rounding === "half-up") {
    // إذا كان ضعف الباقي ≥ المقام، نقرّب لأعلى.
    if (r * 2n >= b) magnitude += 1n;
  }
  // rounding === "down" → truncate (floor للقيمة المطلقة) → لا تعديل.
  return negative ? -magnitude : magnitude;
}
