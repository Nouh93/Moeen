import { AccountSpec, normalSide, Side } from "./account.js";
import {
  CurrencyMismatchError,
  InsufficientFundsError,
  InvalidAmountError,
  LedgerError,
  UnbalancedEntryError,
  UnknownAccountError,
} from "./errors.js";
import { Money } from "./money.js";

/** سطر واحد في قيد: حركة على حساب في اتجاه مدين أو دائن. */
export interface PostingInput {
  readonly accountId: string;
  readonly side: Side;
  /** مبلغ موجب دائماً (الاتجاه يحدّده side، لا الإشارة). */
  readonly amount: Money;
}

export interface JournalEntryInput {
  /**
   * مفتاح فريد يمنع الترحيل المزدوج. تكرار نفس المفتاح = لا عملية (idempotent).
   * مثال: payment:MOEEN-123-202606:settled
   */
  readonly idempotencyKey: string;
  readonly description: string;
  readonly postings: PostingInput[];
  /** مرجع خارجي اختياري للتدقيق (مرجع الفاتورة، معرّف الطلب…). */
  readonly reference?: string;
  readonly occurredAt?: Date;
}

export interface PostedEntry extends JournalEntryInput {
  readonly occurredAt: Date;
  readonly sequence: number;
}

/**
 * دفتر أستاذ بالقيد المزدوج (in-memory aggregate).
 *
 * ضمانات لا تُخرَق:
 *  1) كل قيد متوازن: مجموع المدين = مجموع الدائن لكل عملة.
 *  2) idempotent: تكرار مفتاح الترحيل لا يُغيّر شيئاً.
 *  3) لا رصيد سالب على الحسابات المحميّة (allowNegative=false).
 *  4) تجانس العملة: لا يُخلط بين عملتين في حساب أو قيد.
 *
 * هذا الصنف هو "مصدر الحقيقة" المنطقي؛ طبقة الحفظ (Postgres/Prisma) تعكس
 * نفس القواعد داخل معاملة (transaction) واحدة.
 */
export class Ledger {
  private readonly accounts = new Map<string, AccountSpec>();
  private readonly balances = new Map<string, Money>();
  private readonly seenKeys = new Map<string, PostedEntry>();
  private readonly entries: PostedEntry[] = [];
  private sequence = 0;

  /** يفتح حساباً جديداً برصيد صفري. */
  openAccount(spec: AccountSpec): void {
    if (this.accounts.has(spec.id)) {
      throw new LedgerError(`Account already exists: ${spec.id}`);
    }
    this.accounts.set(spec.id, spec);
    this.balances.set(spec.id, Money.zero(spec.currency));
  }

  hasAccount(id: string): boolean {
    return this.accounts.has(id);
  }

  /** الرصيد بالجانب الطبيعي للحساب (موجب = الاتجاه الطبيعي). */
  balanceOf(accountId: string): Money {
    const balance = this.balances.get(accountId);
    if (!balance) throw new UnknownAccountError(`Unknown account: ${accountId}`);
    return balance;
  }

  /**
   * يُرحّل قيداً. ذرّي: إمّا أن تُطبَّق كل السطور أو لا شيء (يُتحقَّق قبل التطبيق).
   * يُعيد القيد المُرحّل، أو القيد السابق نفسه إن تكرّر المفتاح (idempotent).
   */
  post(input: JournalEntryInput): PostedEntry {
    const existing = this.seenKeys.get(input.idempotencyKey);
    if (existing) return existing;

    if (input.postings.length < 2) {
      throw new UnbalancedEntryError("A journal entry requires at least two postings");
    }

    // 1) تحقّق من صحة كل سطر، وتجانس العملة، والتوازن.
    const debitByCurrency = new Map<string, bigint>();
    const creditByCurrency = new Map<string, bigint>();

    for (const posting of input.postings) {
      const account = this.accounts.get(posting.accountId);
      if (!account) throw new UnknownAccountError(`Unknown account: ${posting.accountId}`);
      if (posting.amount.currency.code !== account.currency) {
        throw new CurrencyMismatchError(
          `Posting currency ${posting.amount.currency.code} != account ${account.id} currency ${account.currency}`,
        );
      }
      if (!posting.amount.isPositive()) {
        throw new InvalidAmountError("Posting amount must be strictly positive");
      }
      const bucket = posting.side === "DEBIT" ? debitByCurrency : creditByCurrency;
      const code = posting.amount.currency.code;
      bucket.set(code, (bucket.get(code) ?? 0n) + posting.amount.amount);
    }

    const currencies = new Set<string>([...debitByCurrency.keys(), ...creditByCurrency.keys()]);
    for (const code of currencies) {
      const debit = debitByCurrency.get(code) ?? 0n;
      const credit = creditByCurrency.get(code) ?? 0n;
      if (debit !== credit) {
        throw new UnbalancedEntryError(
          `Entry "${input.idempotencyKey}" unbalanced in ${code}: debit ${debit} != credit ${credit}`,
        );
      }
    }

    // 2) احسب الأرصدة الجديدة وتحقّق من قاعدة عدم السلب — قبل أي تطبيق.
    const nextBalances = new Map<string, Money>();
    for (const posting of input.postings) {
      const account = this.accounts.get(posting.accountId)!;
      const current = nextBalances.get(account.id) ?? this.balanceOf(account.id);
      const delta = posting.side === normalSide(account.type) ? posting.amount : posting.amount.negate();
      nextBalances.set(account.id, current.add(delta));
    }
    for (const [accountId, balance] of nextBalances) {
      const account = this.accounts.get(accountId)!;
      if (!account.allowNegative && balance.isNegative()) {
        const before = this.balanceOf(accountId);
        throw new InsufficientFundsError(accountId, before.toString(), balance.negate().toString());
      }
    }

    // 3) طبّق (لا أخطاء بعد هذه النقطة).
    for (const [accountId, balance] of nextBalances) {
      this.balances.set(accountId, balance);
    }
    const posted: PostedEntry = {
      ...input,
      occurredAt: input.occurredAt ?? new Date(),
      sequence: ++this.sequence,
    };
    this.entries.push(posted);
    this.seenKeys.set(input.idempotencyKey, posted);
    return posted;
  }

  /** كل القيود المُرحّلة بالترتيب — للتدقيق. */
  history(): readonly PostedEntry[] {
    return this.entries;
  }

  /**
   * تحقّق شامل من سلامة الدفتر: مجموع كل الأرصدة الموقّعة (بإشارة المعادلة
   * المحاسبية) يجب أن يساوي صفراً لكل عملة. شبكة أمان للاختبارات والمراقبة.
   */
  assertHealthy(): void {
    const signedTotal = new Map<string, bigint>();
    for (const [id, spec] of this.accounts) {
      const balance = this.balanceOf(id);
      // نحوّل رصيد الجانب الطبيعي إلى إشارة المعادلة: الأصول/المصروف موجبة مدينة،
      // الالتزام/الملكية/الدخل موجبة دائنة → الجمع الموقّع يجب أن يكون صفراً.
      const sign = normalSide(spec.type) === "DEBIT" ? 1n : -1n;
      signedTotal.set(spec.currency, (signedTotal.get(spec.currency) ?? 0n) + sign * balance.amount);
    }
    for (const [code, total] of signedTotal) {
      if (total !== 0n) {
        throw new LedgerError(`Ledger out of balance in ${code}: signed total ${total} != 0`);
      }
    }
  }
}
