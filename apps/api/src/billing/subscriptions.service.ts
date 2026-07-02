import { Injectable, NotFoundException } from "@nestjs/common";
import type { Invoice, Subscription } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService, type PostingInput } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { merchantSettlement, merchantWallet, PlatformAccounts } from "../ledger/accounts.js";
import { nonZero } from "../orders/orders.service.js";
import { invoiceReference, DAY_MS } from "./billing.constants.js";

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  /** ينشئ اشتراكاً نشطاً لتاجر (إن لم يوجد) بدورة شهرية. */
  async createSubscription(
    merchantId: string,
    priceMinor: bigint,
    periodStart: Date = new Date(),
  ): Promise<Subscription> {
    await this.accounts.ensurePlatform();
    await this.accounts.ensureMerchant(merchantId);

    const periodEnd = new Date(periodStart.getTime() + 30 * DAY_MS);
    return this.prisma.subscription.create({
      data: {
        merchantId,
        status: "ACTIVE",
        priceMinor,
        periodStart,
        periodEnd,
      },
    });
  }

  /**
   * يُصدر فاتورة الشهر (idempotent عبر المرجع الفريد)، ثم يحاول التحصيل الآلي من
   * الرصيد المسبق (waterfall: رصيد المدفوعات ← المحفظة). إن لم يكفِ تبقى مفتوحة
   * بانتظار دفع خارجي يُطابقه محرّك المطابقة.
   */
  async issueMonthlyInvoice(merchantId: string, now: Date = new Date()): Promise<Invoice> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { merchantId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("لا يوجد اشتراك للتاجر");

    const reference = invoiceReference(merchantId, now);
    const existing = await this.prisma.invoice.findUnique({ where: { reference } });
    if (existing) return existing;

    const invoice = await this.prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        reference,
        status: "OPEN",
        amountMinor: subscription.priceMinor,
        dueAt: new Date(now.getTime() + 7 * DAY_MS),
      },
    });

    await this.tryAutoCollect(invoice, merchantId);
    return this.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  }

  /**
   * تحصيل آلي من الرصيد المسبق إن كفى. يُقيّد: رصيد المدفوعات ثم المحفظة (مدين)
   * مقابل دخل الاشتراك (دائن)، ويضع الفاتورة مدفوعة ويُبقي الحساب نشطاً.
   */
  async tryAutoCollect(invoice: Invoice, merchantId: string): Promise<boolean> {
    const amount = invoice.amountMinor;
    const settlement = await this.ledger.balanceOf(merchantSettlement(merchantId));
    const wallet = await this.ledger.balanceOf(merchantWallet(merchantId));
    if (settlement + wallet < amount) return false; // غير كافٍ → تبقى مفتوحة

    const fromSettlement = settlement >= amount ? amount : settlement;
    const fromWallet = amount - fromSettlement;
    const postings: PostingInput[] = nonZero([
      { accountCode: merchantSettlement(merchantId), side: "DEBIT", amountMinor: fromSettlement },
      { accountCode: merchantWallet(merchantId), side: "DEBIT", amountMinor: fromWallet },
      { accountCode: PlatformAccounts.REVENUE_SUBSCRIPTION, side: "CREDIT", amountMinor: amount },
    ]);
    await this.ledger.post({
      idempotencyKey: `subscription-collect:${invoice.reference}`,
      description: `تحصيل اشتراك آلي من الرصيد ${invoice.reference}`,
      reference: invoice.reference,
      postings,
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date() },
    });
    return true;
  }
}
