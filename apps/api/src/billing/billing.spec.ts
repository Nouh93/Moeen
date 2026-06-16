import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import { PlatformAccounts } from "../ledger/accounts.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { ReconciliationService } from "./reconciliation.service.js";
import { DunningService } from "./dunning.service.js";
import { DAY_MS } from "./billing.constants.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const ledger = new LedgerService(prisma);
const accounts = new AccountsService(ledger);
const wallet = new WalletService(ledger, accounts);
const subscriptions = new SubscriptionsService(prisma, ledger, accounts);
const reconciliation = new ReconciliationService(prisma, ledger, accounts);
const dunning = new DunningService(prisma);

let counter = 0;

async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}

async function seedMerchant(createdAt?: Date): Promise<string> {
  counter += 1;
  const user = await prisma.user.create({
    data: { phone: `+96777${String(100000 + counter)}`, fullName: "تاجر", role: "MERCHANT" },
  });
  const merchant = await prisma.merchant.create({
    data: {
      userId: user.id,
      businessName: "متجر",
      governorate: "صنعاء",
      status: "ACTIVE",
      ...(createdAt ? { createdAt } : {}),
    },
  });
  await accounts.ensurePlatform();
  await accounts.ensureMerchant(merchant.id);
  return merchant.id;
}

const bal = (code: string) => ledger.balanceOf(code);

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("SubscriptionsService — التحصيل الآلي من الرصيد المسبق", () => {
  beforeEach(reset);

  it("يحصّل الاشتراك آلياً إن كفى الرصيد ويضع الفاتورة مدفوعة", async () => {
    const merchantId = await seedMerchant();
    await wallet.topUp(merchantId, 5000n, `tp-${merchantId}`);
    await subscriptions.createSubscription(merchantId, 3000n);

    const invoice = await subscriptions.issueMonthlyInvoice(merchantId);
    expect(invoice.status).toBe("PAID");
    expect(await bal(PlatformAccounts.REVENUE_SUBSCRIPTION)).toBe(3000n);
    expect(await wallet.balance(merchantId)).toBe(2000n);
  });

  it("تبقى الفاتورة مفتوحة إن لم يكفِ الرصيد", async () => {
    const merchantId = await seedMerchant();
    await subscriptions.createSubscription(merchantId, 3000n);
    const invoice = await subscriptions.issueMonthlyInvoice(merchantId);
    expect(invoice.status).toBe("OPEN");
    expect(await bal(PlatformAccounts.REVENUE_SUBSCRIPTION)).toBe(0n);
  });

  it("idempotent: إصدار نفس الشهر مرتين لا يُكرّر الفاتورة", async () => {
    const merchantId = await seedMerchant();
    await subscriptions.createSubscription(merchantId, 3000n);
    const a = await subscriptions.issueMonthlyInvoice(merchantId);
    const b = await subscriptions.issueMonthlyInvoice(merchantId);
    expect(b.id).toBe(a.id);
    expect(await prisma.invoice.count()).toBe(1);
  });
});

d("ReconciliationService — المطابقة الآلية", () => {
  beforeEach(reset);

  async function openInvoice(merchantId: string, amount = 3000n) {
    await subscriptions.createSubscription(merchantId, amount);
    return subscriptions.issueMonthlyInvoice(merchantId); // OPEN (لا رصيد)
  }

  it("يطابق دفعة بمرجع ومبلغ صحيحين → تفعيل آلي وقيد تحصيل", async () => {
    const merchantId = await seedMerchant();
    const invoice = await openInvoice(merchantId);

    const payment = await reconciliation.ingest({
      externalRef: "pay-1",
      source: "AGGREGATOR",
      amountMinor: 3000n,
      reference: invoice.reference,
    });

    expect(payment.status).toBe("MATCHED");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("ACTIVE");
    expect(await bal(PlatformAccounts.REVENUE_SUBSCRIPTION)).toBe(3000n);
    expect(await bal(PlatformAccounts.COD_CLEARING)).toBe(3000n);
  });

  it("يضع الدفعة في الاستثناءات عند عدم تطابق المبلغ", async () => {
    const merchantId = await seedMerchant();
    const invoice = await openInvoice(merchantId);
    const payment = await reconciliation.ingest({
      externalRef: "pay-bad",
      source: "AGGREGATOR",
      amountMinor: 2500n, // مبلغ مختلف
      reference: invoice.reference,
    });
    expect(payment.status).toBe("EXCEPTION");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("OPEN");
  });

  it("مرجع مجهول → استثناء", async () => {
    await seedMerchant();
    const payment = await reconciliation.ingest({
      externalRef: "pay-x",
      source: "BANK_TRANSFER",
      amountMinor: 3000n,
      reference: "MOEEN-unknown-202606",
    });
    expect(payment.status).toBe("EXCEPTION");
  });

  it("idempotent: تكرار نفس externalRef لا يُكرّر القيد", async () => {
    const merchantId = await seedMerchant();
    const invoice = await openInvoice(merchantId);
    const event = {
      externalRef: "pay-dup",
      source: "AGGREGATOR" as const,
      amountMinor: 3000n,
      reference: invoice.reference,
    };
    const first = await reconciliation.ingest(event);
    const second = await reconciliation.ingest(event);
    expect(second.id).toBe(first.id);
    expect(await prisma.payment.count()).toBe(1);
    expect(await bal(PlatformAccounts.REVENUE_SUBSCRIPTION)).toBe(3000n); // مرة واحدة
  });
});

d("DunningService — الإنذار والتعليق والإغلاق", () => {
  beforeEach(reset);

  async function openInvoiceAged(merchantId: string, ageDays: number, amount = 3000n) {
    await subscriptions.createSubscription(merchantId, amount);
    const invoice = await subscriptions.issueMonthlyInvoice(merchantId);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { issuedAt: new Date(Date.now() - ageDays * DAY_MS) },
    });
    return invoice;
  }

  it("يعلّق التاجر القديم بعد 15 يوماً ويُخفي متجره", async () => {
    const merchantId = await seedMerchant(new Date(Date.now() - 200 * DAY_MS));
    await prisma.store.create({
      data: { merchantId, name: "متجر", slug: `s-${merchantId}`, isVisible: true },
    });
    await openInvoiceAged(merchantId, 16);

    const summary = await dunning.runCycle();
    expect(summary.suspended).toContain(merchantId);
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("SUSPENDED");
    expect((await prisma.store.findFirstOrThrow({ where: { merchantId } })).isVisible).toBe(false);
  });

  it("لا يعلّق التاجر الجديد (إعفاء أول شهرين)", async () => {
    const merchantId = await seedMerchant(new Date()); // جديد
    await openInvoiceAged(merchantId, 16);
    const summary = await dunning.runCycle();
    expect(summary.suspended).not.toContain(merchantId);
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("ACTIVE");
  });

  it("يُغلق التاجر القديم بعد 37 يوماً", async () => {
    const merchantId = await seedMerchant(new Date(Date.now() - 200 * DAY_MS));
    await openInvoiceAged(merchantId, 40);
    const summary = await dunning.runCycle();
    expect(summary.closed).toContain(merchantId);
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("CLOSED");
  });

  it("الدفع بعد التعليق يُعيد التفعيل آلياً", async () => {
    const merchantId = await seedMerchant(new Date(Date.now() - 200 * DAY_MS));
    await prisma.store.create({
      data: { merchantId, name: "متجر", slug: `s2-${merchantId}`, isVisible: true },
    });
    const invoice = await openInvoiceAged(merchantId, 16);
    await dunning.runCycle();
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("SUSPENDED");

    await reconciliation.ingest({
      externalRef: "pay-reactivate",
      source: "AGGREGATOR",
      amountMinor: 3000n,
      reference: invoice.reference,
    });

    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } })).status).toBe("ACTIVE");
    expect((await prisma.store.findFirstOrThrow({ where: { merchantId } })).isVisible).toBe(true);
  });
});
