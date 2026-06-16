import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InsufficientFundsError, UnbalancedEntryError } from "@moeen/ledger";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "./ledger.service.js";

/**
 * اختبار تكامل حقيقي ضد PostgreSQL (يتطلّب DATABASE_URL وقاعدة مُهيّأة).
 * يتخطّى نفسه إن لم تتوفّر قاعدة البيانات.
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const ledger = new LedgerService(prisma);

async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("LedgerService — تكامل مع PostgreSQL", () => {
  beforeEach(async () => {
    await reset();
    await ledger.ensureAccount({ code: "cash", type: "ASSET", allowNegative: true });
    await ledger.ensureAccount({ code: "wallet:merchant:m1", type: "LIABILITY", merchantId: null as never });
    await ledger.ensureAccount({ code: "payable:carrier", type: "LIABILITY" });
  });

  it("يشحن المحفظة ويحدّث الرصيد بثبات", async () => {
    await ledger.post({
      idempotencyKey: "topup:1",
      description: "شحن 5000",
      postings: [
        { accountCode: "cash", side: "DEBIT", amountMinor: 5000n },
        { accountCode: "wallet:merchant:m1", side: "CREDIT", amountMinor: 5000n },
      ],
    });
    expect(await ledger.balanceOf("wallet:merchant:m1")).toBe(5000n);
    expect(await ledger.balanceOf("cash")).toBe(5000n);
  });

  it("idempotent: تكرار نفس المفتاح لا يُرحّل مرتين", async () => {
    const entry = {
      idempotencyKey: "topup:dup",
      description: "شحن",
      postings: [
        { accountCode: "cash", side: "DEBIT" as const, amountMinor: 5000n },
        { accountCode: "wallet:merchant:m1", side: "CREDIT" as const, amountMinor: 5000n },
      ],
    };
    const first = await ledger.post(entry);
    const second = await ledger.post(entry);
    expect(second.id).toBe(first.id);
    expect(second.idempotent).toBe(true);
    expect(await ledger.balanceOf("wallet:merchant:m1")).toBe(5000n);
    expect(await prisma.journalEntry.count()).toBe(1);
  });

  it("يرفض القيد غير المتوازن", async () => {
    await expect(
      ledger.post({
        idempotencyKey: "bad",
        description: "غير متوازن",
        postings: [
          { accountCode: "cash", side: "DEBIT", amountMinor: 100n },
          { accountCode: "wallet:merchant:m1", side: "CREDIT", amountMinor: 90n },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedEntryError);
    expect(await prisma.journalEntry.count()).toBe(0);
  });

  it("يمنع الرصيد السالب ولا يكتب شيئاً (ذرّي)", async () => {
    await ledger.post({
      idempotencyKey: "topup:small",
      description: "شحن 1000",
      postings: [
        { accountCode: "cash", side: "DEBIT", amountMinor: 1000n },
        { accountCode: "wallet:merchant:m1", side: "CREDIT", amountMinor: 1000n },
      ],
    });
    await expect(
      ledger.post({
        idempotencyKey: "charge:big",
        description: "خصم 1500 > الرصيد",
        postings: [
          { accountCode: "wallet:merchant:m1", side: "DEBIT", amountMinor: 1500n },
          { accountCode: "payable:carrier", side: "CREDIT", amountMinor: 1500n },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await ledger.balanceOf("wallet:merchant:m1")).toBe(1000n);
    expect(await prisma.journalEntry.count()).toBe(1);
  });

  it("التزامن: 20 شحناً متوازياً يُطبَّق كلها بدقّة بلا فقدان", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        ledger.post({
          idempotencyKey: `concurrent:${i}`,
          description: "شحن متزامن",
          postings: [
            { accountCode: "cash", side: "DEBIT", amountMinor: 100n },
            { accountCode: "wallet:merchant:m1", side: "CREDIT", amountMinor: 100n },
          ],
        }),
      ),
    );
    expect(await ledger.balanceOf("wallet:merchant:m1")).toBe(2000n);
  });
});
