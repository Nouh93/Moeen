import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { merchantSettlement, PlatformAccounts } from "../ledger/accounts.js";
import { PayoutsService } from "./payouts.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const ledger = new LedgerService(prisma);
const accounts = new AccountsService(ledger);
const payouts = new PayoutsService(prisma, ledger, accounts);

let counter = 0;
async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}
async function seedMerchantWithSettlement(amount: bigint): Promise<string> {
  counter += 1;
  const user = await prisma.user.create({
    data: { phone: `+96777${String(600000 + counter)}`, fullName: "ت", role: "MERCHANT" },
  });
  const merchant = await prisma.merchant.create({
    data: { userId: user.id, businessName: "م", governorate: "صنعاء" },
  });
  await accounts.ensurePlatform();
  await accounts.ensureMerchant(merchant.id);
  // نموّل رصيد التسوية عبر قيد: نقد (أصل) ← تسوية التاجر (التزام).
  if (amount > 0n) {
    await ledger.post({
      idempotencyKey: `seed-settle:${merchant.id}`,
      description: "تمويل تسوية للاختبار",
      postings: [
        { accountCode: PlatformAccounts.CASH, side: "DEBIT", amountMinor: amount },
        { accountCode: merchantSettlement(merchant.id), side: "CREDIT", amountMinor: amount },
      ],
    });
  }
  return merchant.id;
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("PayoutsService — إغلاق الدورة المالية", () => {
  beforeEach(reset);

  it("يحجز السحب من التسوية ثم يصرفه فيقلّ النقد", async () => {
    const id = await seedMerchantWithSettlement(10000n);
    const payout = await payouts.request(id, 6000n);
    expect(payout.status).toBe("PENDING");
    // التسوية نقصت، والمستحقات ارتفعت.
    expect(await ledger.balanceOf(merchantSettlement(id))).toBe(4000n);
    expect(await ledger.balanceOf(PlatformAccounts.PAYABLE_PAYOUTS)).toBe(6000n);

    const cashBefore = await ledger.balanceOf(PlatformAccounts.CASH);
    await payouts.markPaid(payout.id, "جوالي");
    expect((await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })).status).toBe("PAID");
    expect(await ledger.balanceOf(PlatformAccounts.PAYABLE_PAYOUTS)).toBe(0n);
    expect(await ledger.balanceOf(PlatformAccounts.CASH)).toBe(cashBefore - 6000n);
  });

  it("يرفض سحب أكثر من الرصيد القابل للسحب", async () => {
    const id = await seedMerchantWithSettlement(2000n);
    await expect(payouts.request(id, 5000n)).rejects.toBeInstanceOf(BadRequestException);
    expect(await ledger.balanceOf(merchantSettlement(id))).toBe(2000n); // لم يتغيّر
    expect(await prisma.payout.count()).toBe(0); // لم يُنشأ طلب
  });

  it("تأكيد الصرف idempotent", async () => {
    const id = await seedMerchantWithSettlement(10000n);
    const payout = await payouts.request(id, 3000n);
    await payouts.markPaid(payout.id);
    await payouts.markPaid(payout.id);
    expect(await ledger.balanceOf(PlatformAccounts.PAYABLE_PAYOUTS)).toBe(0n);
  });
});
