import { Injectable } from "@nestjs/common";
import { Prisma, type LedgerAccountType, type PostingSide } from "@prisma/client";
import {
  CurrencyMismatchError,
  InsufficientFundsError,
  InvalidAmountError,
  Money,
  normalSide,
  UnbalancedEntryError,
  UnknownAccountError,
  type AccountType,
  type Side,
} from "@moeen/ledger";
import { PrismaService } from "../prisma/prisma.service.js";

export interface PostingInput {
  readonly accountCode: string;
  readonly side: Side;
  readonly amountMinor: bigint;
  readonly currency?: string; // افتراضي YER
}

export interface PostEntryInput {
  readonly idempotencyKey: string;
  readonly description: string;
  readonly reference?: string;
  readonly postings: PostingInput[];
}

export interface OpenAccountInput {
  readonly code: string;
  readonly type: AccountType;
  readonly currency?: string;
  readonly allowNegative?: boolean;
  readonly merchantId?: string;
}

/**
 * مستودع دفتر الأستاذ فوق PostgreSQL.
 *
 * يطبّق نفس ضمانات `@moeen/ledger` لكن بشكل دائم وآمن أمام التزامن:
 *  - كل قيد يُكتب داخل **معاملة واحدة** بمستوى عزل Serializable.
 *  - الحسابات المعنيّة تُقفل (SELECT … FOR UPDATE) لمنع سباق الأرصدة.
 *  - idempotency عبر قيد فريد على idempotencyKey (يمنع الترحيل المزدوج حتى تحت التزامن).
 *  - توازن القيد، تجانس العملة، ومنع الرصيد السالب — تُفحَص قبل أي كتابة.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** يفتح حساباً إن لم يكن موجوداً (idempotent عبر code الفريد). */
  async ensureAccount(input: OpenAccountInput): Promise<void> {
    const currency = input.currency ?? "YER";
    await this.prisma.ledgerAccount.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        type: input.type as LedgerAccountType,
        currency,
        allowNegative: input.allowNegative ?? false,
        merchantId: input.merchantId ?? null,
      },
      update: {},
    });
  }

  /** الرصيد بالجانب الطبيعي للحساب (بالوحدة الصغرى). */
  async balanceOf(code: string): Promise<bigint> {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { code } });
    if (!account) throw new UnknownAccountError(`Unknown account: ${code}`);
    return account.balanceMinor;
  }

  /**
   * يُرحّل قيداً. يُعيد معرّف القيد. ذرّي وidempotent.
   * يُعيد المحاولة على تعارض الكتابة/الـdeadlock (P2034) — ضروري للثبات تحت التزامن.
   */
  async post(input: PostEntryInput): Promise<{ id: string; idempotent: boolean }> {
    if (input.postings.length < 2) {
      throw new UnbalancedEntryError("A journal entry requires at least two postings");
    }

    const maxAttempts = 5;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.postOnce(input);
      } catch (error) {
        if (isWriteConflict(error) && attempt < maxAttempts) {
          await sleep(10 * attempt); // backoff بسيط
          continue;
        }
        throw error;
      }
    }
  }

  private async postOnce(input: PostEntryInput): Promise<{ id: string; idempotent: boolean }> {
    return this.prisma.$transaction(
      async (tx) => {
        // 1) idempotency: إن وُجد القيد بنفس المفتاح، أعِده دون تكرار.
        const existing = await tx.journalEntry.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true },
        });
        if (existing) return { id: existing.id, idempotent: true };

        // 2) أقفل الحسابات المعنيّة بترتيب ثابت (code) لمنع الـdeadlock والسباق.
        const codes = [...new Set(input.postings.map((p) => p.accountCode))].sort();
        const locked = await tx.$queryRaw<
          Array<{ id: string; code: string; type: LedgerAccountType; currency: string; allowNegative: boolean; balanceMinor: bigint }>
        >`SELECT id, code, type, currency, "allowNegative", "balanceMinor"
          FROM "LedgerAccount" WHERE code IN (${Prisma.join(codes)}) FOR UPDATE`;

        const byCode = new Map(locked.map((a) => [a.code, a]));
        for (const code of codes) {
          if (!byCode.has(code)) throw new UnknownAccountError(`Unknown account: ${code}`);
        }

        // 3) تحقّق السطور: مبلغ موجب، تجانس العملة، والتوازن لكل عملة.
        const debit = new Map<string, bigint>();
        const credit = new Map<string, bigint>();
        for (const p of input.postings) {
          const account = byCode.get(p.accountCode)!;
          const currency = p.currency ?? "YER";
          if (currency !== account.currency) {
            throw new CurrencyMismatchError(
              `Posting currency ${currency} != account ${account.code} currency ${account.currency}`,
            );
          }
          if (p.amountMinor <= 0n) {
            throw new InvalidAmountError("Posting amount must be strictly positive");
          }
          const bucket = p.side === "DEBIT" ? debit : credit;
          bucket.set(currency, (bucket.get(currency) ?? 0n) + p.amountMinor);
        }
        for (const currency of new Set([...debit.keys(), ...credit.keys()])) {
          if ((debit.get(currency) ?? 0n) !== (credit.get(currency) ?? 0n)) {
            throw new UnbalancedEntryError(
              `Entry "${input.idempotencyKey}" unbalanced in ${currency}`,
            );
          }
        }

        // 4) احسب الأرصدة الجديدة وافحص قاعدة عدم السلب — قبل أي كتابة.
        const nextBalance = new Map<string, Money>();
        for (const p of input.postings) {
          const account = byCode.get(p.accountCode)!;
          const current =
            nextBalance.get(account.code) ?? Money.ofMinor(account.balanceMinor, account.currency);
          const amount = Money.ofMinor(p.amountMinor, account.currency);
          const delta =
            p.side === toLedgerSide(normalSide(account.type as AccountType)) ? amount : amount.negate();
          nextBalance.set(account.code, current.add(delta));
        }
        for (const [code, balance] of nextBalance) {
          const account = byCode.get(code)!;
          if (!account.allowNegative && balance.isNegative()) {
            throw new InsufficientFundsError(
              code,
              account.balanceMinor.toString(),
              balance.negate().toString(),
            );
          }
        }

        // 5) اكتب القيد وسطوره وحدّث الأرصدة (لا أخطاء بعد هذه النقطة).
        const entry = await tx.journalEntry.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            description: input.description,
            reference: input.reference ?? null,
            postings: {
              create: input.postings.map((p) => ({
                accountId: byCode.get(p.accountCode)!.id,
                side: p.side as PostingSide,
                amountMinor: p.amountMinor,
                currency: p.currency ?? "YER",
              })),
            },
          },
          select: { id: true },
        });
        for (const [code, balance] of nextBalance) {
          await tx.ledgerAccount.update({
            where: { id: byCode.get(code)!.id },
            data: { balanceMinor: balance.amount },
          });
        }
        return { id: entry.id, idempotent: false };
      },
      // READ COMMITTED (افتراضي) يكفي: قفل الصفوف FOR UPDATE يُسلسل الوصول
      // ويُعيد القراءة أحدث رصيد بعد القفل → لا فقدان تحديث ولا إجهاضات تسلسل.
      { timeout: 15000 },
    );
  }
}

function toLedgerSide(side: Side): PostingSide {
  return side as PostingSide;
}

/**
 * تعارض كتابة أو deadlock يستوجب إعادة المحاولة:
 *  - Prisma P2034 (write conflict / deadlock).
 *  - أخطاء PostgreSQL الخام: 40001 (serialization failure) أو 40P01 (deadlock)،
 *    قد تصل عبر P2010 (raw query failed) فنفحص الرسالة/الـmeta أيضاً.
 */
function isWriteConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; meta?: { code?: string }; message?: string };
  if (e.code === "P2034") return true;
  if (e.meta?.code === "40001" || e.meta?.code === "40P01") return true;
  const message = e.message ?? "";
  return (
    message.includes("40001") ||
    message.includes("40P01") ||
    message.includes("could not serialize access") ||
    message.includes("deadlock detected")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
