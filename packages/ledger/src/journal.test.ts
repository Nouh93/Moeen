import { beforeEach, describe, expect, it } from "vitest";
import {
  InsufficientFundsError,
  UnbalancedEntryError,
  UnknownAccountError,
} from "./errors.js";
import { Ledger } from "./journal.js";
import { Money } from "./money.js";

const YER = (minor: bigint | number) => Money.ofMinor(minor, "YER");

describe("Ledger — القواعد الأساسية للقيد المزدوج", () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = new Ledger();
    ledger.openAccount({ id: "cash", type: "ASSET", currency: "YER", allowNegative: true });
    ledger.openAccount({ id: "wallet:m1", type: "LIABILITY", currency: "YER" });
    ledger.openAccount({ id: "settlement:m1", type: "LIABILITY", currency: "YER" });
    ledger.openAccount({ id: "revenue:commission", type: "REVENUE", currency: "YER" });
    ledger.openAccount({ id: "expense:mdr", type: "EXPENSE", currency: "YER" });
  });

  it("يرفض القيد غير المتوازن", () => {
    expect(() =>
      ledger.post({
        idempotencyKey: "bad-1",
        description: "غير متوازن",
        postings: [
          { accountId: "cash", side: "DEBIT", amount: YER(100) },
          { accountId: "wallet:m1", side: "CREDIT", amount: YER(90) },
        ],
      }),
    ).toThrow(UnbalancedEntryError);
  });

  it("يرفض الترحيل على حساب غير موجود", () => {
    expect(() =>
      ledger.post({
        idempotencyKey: "bad-2",
        description: "حساب مجهول",
        postings: [
          { accountId: "cash", side: "DEBIT", amount: YER(100) },
          { accountId: "ghost", side: "CREDIT", amount: YER(100) },
        ],
      }),
    ).toThrow(UnknownAccountError);
  });

  it("شحن محفظة التاجر: نقد مدين، التزام المحفظة دائن", () => {
    ledger.post({
      idempotencyKey: "topup:m1:1",
      description: "شحن محفظة 5000",
      postings: [
        { accountId: "cash", side: "DEBIT", amount: YER(5000) },
        { accountId: "wallet:m1", side: "CREDIT", amount: YER(5000) },
      ],
    });
    expect(ledger.balanceOf("wallet:m1").amount).toBe(5000n);
    ledger.assertHealthy();
  });
});

describe("Ledger — idempotency", () => {
  it("تكرار نفس المفتاح لا يُرحّل مرتين", () => {
    const ledger = new Ledger();
    ledger.openAccount({ id: "cash", type: "ASSET", currency: "YER", allowNegative: true });
    ledger.openAccount({ id: "wallet:m1", type: "LIABILITY", currency: "YER" });

    const entry = {
      idempotencyKey: "topup:m1:dup",
      description: "شحن",
      postings: [
        { accountId: "cash", side: "DEBIT" as const, amount: YER(5000) },
        { accountId: "wallet:m1", side: "CREDIT" as const, amount: YER(5000) },
      ],
    };
    const first = ledger.post(entry);
    const second = ledger.post(entry);
    expect(second.sequence).toBe(first.sequence);
    expect(ledger.balanceOf("wallet:m1").amount).toBe(5000n); // مرة واحدة فقط
    expect(ledger.history()).toHaveLength(1);
  });
});

describe("Ledger — سيناريو PayFac من الـPRD (24.8.1)", () => {
  it("العميل يدفع 10,000؛ يُقيَّد للتاجر صافياً بعد رسوم البوابة والعمولة", () => {
    const ledger = new Ledger();
    ledger.openAccount({ id: "cash", type: "ASSET", currency: "YER", allowNegative: true });
    ledger.openAccount({ id: "settlement:m1", type: "LIABILITY", currency: "YER" });
    ledger.openAccount({ id: "payable:acquirer", type: "LIABILITY", currency: "YER" });
    ledger.openAccount({ id: "revenue:commission", type: "REVENUE", currency: "YER" });
    ledger.openAccount({ id: "expense:mdr", type: "EXPENSE", currency: "YER" });

    // العميل دفع 10,000؛ الصافي للتاجر 9,500 → إجمالي دخل المنصة من البيع 500.
    // من هذا الإجمالي: رسوم البوابة (MDR) 200 مصروف مستحقّ للمستحوذ، والصافي للمنصة 300.
    //   مدين: نقد 10,000 + مصروف MDR 200 = 10,200
    //   دائن: تسوية التاجر 9,500 + دخل العمولة (إجمالي) 500 + مستحقّ للمستحوذ 200 = 10,200
    ledger.post({
      idempotencyKey: "payment:order-1:settled",
      description: "دفع طلب إلكتروني",
      reference: "order-1",
      postings: [
        { accountId: "cash", side: "DEBIT", amount: YER(10000) },
        { accountId: "expense:mdr", side: "DEBIT", amount: YER(200) },
        { accountId: "settlement:m1", side: "CREDIT", amount: YER(9500) },
        { accountId: "revenue:commission", side: "CREDIT", amount: YER(500) },
        { accountId: "payable:acquirer", side: "CREDIT", amount: YER(200) },
      ],
    });

    expect(ledger.balanceOf("settlement:m1").amount).toBe(9500n);
    expect(ledger.balanceOf("revenue:commission").amount).toBe(500n); // إجمالي
    expect(ledger.balanceOf("expense:mdr").amount).toBe(200n);
    expect(ledger.balanceOf("payable:acquirer").amount).toBe(200n);
    expect(ledger.balanceOf("cash").amount).toBe(10000n); // النقد الوارد كاملاً قبل دفع المستحوذ
    // صافي ربح المنصة = دخل 500 − مصروف 200 = 300
    ledger.assertHealthy();
  });
});

describe("Ledger — قاعدة لا رصيد سالب (24.8.5، الحد = 0)", () => {
  let ledger: Ledger;
  beforeEach(() => {
    ledger = new Ledger();
    ledger.openAccount({ id: "cash", type: "ASSET", currency: "YER", allowNegative: true });
    ledger.openAccount({ id: "wallet:m1", type: "LIABILITY", currency: "YER" });
    ledger.openAccount({ id: "payable:carrier", type: "LIABILITY", currency: "YER" });
  });

  it("يمنع خصم شحن يتحمّله التاجر إن لم تكفِ المحفظة، ولا يُغيّر الرصيد", () => {
    ledger.post({
      idempotencyKey: "topup:m1",
      description: "شحن 1000",
      postings: [
        { accountId: "cash", side: "DEBIT", amount: YER(1000) },
        { accountId: "wallet:m1", side: "CREDIT", amount: YER(1000) },
      ],
    });

    expect(() =>
      ledger.post({
        idempotencyKey: "shipping:order-9",
        description: "شحن مجاني يتحمّله التاجر 1500",
        postings: [
          { accountId: "wallet:m1", side: "DEBIT", amount: YER(1500) },
          { accountId: "payable:carrier", side: "CREDIT", amount: YER(1500) },
        ],
      }),
    ).toThrow(InsufficientFundsError);

    // الرصيد كما هو — العملية ذرّية ولم تُطبَّق جزئياً.
    expect(ledger.balanceOf("wallet:m1").amount).toBe(1000n);
    expect(ledger.history()).toHaveLength(1);
  });

  it("يسمح بالخصم إذا كان الرصيد كافياً تماماً وينزل إلى صفر", () => {
    ledger.post({
      idempotencyKey: "topup:m1",
      description: "شحن 1500",
      postings: [
        { accountId: "cash", side: "DEBIT", amount: YER(1500) },
        { accountId: "wallet:m1", side: "CREDIT", amount: YER(1500) },
      ],
    });
    ledger.post({
      idempotencyKey: "shipping:order-9",
      description: "شحن 1500 يتحمّله التاجر",
      postings: [
        { accountId: "wallet:m1", side: "DEBIT", amount: YER(1500) },
        { accountId: "payable:carrier", side: "CREDIT", amount: YER(1500) },
      ],
    });
    expect(ledger.balanceOf("wallet:m1").amount).toBe(0n);
    ledger.assertHealthy();
  });
});
