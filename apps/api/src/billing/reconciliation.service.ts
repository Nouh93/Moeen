import { Injectable, Logger } from "@nestjs/common";
import type { Payment, PaymentSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { PlatformAccounts } from "../ledger/accounts.js";

export interface PaymentEvent {
  /** مفتاح فريد من المزوّد يمنع المعالجة المزدوجة (idempotency). */
  externalRef: string;
  source: PaymentSource;
  amountMinor: bigint;
  /** المرجع المُعلَن (MOEEN-...): أساس المطابقة. */
  reference?: string;
  rawPayload?: unknown;
}

/**
 * محرّك المطابقة الآلية (PRD 24.1):
 *  - كل حدث وارد يدخل **idempotently** (تفرّد externalRef).
 *  - يُطابَق بالمرجع الفريد + تطابق المبلغ → تفعيل آلي + قيد تحصيل.
 *  - غير مطابق/غامض → حالة EXCEPTION لطابور المراجعة البشرية الصغير.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  async ingest(event: PaymentEvent): Promise<Payment> {
    // idempotency على مستوى الحدث.
    const seen = await this.prisma.payment.findUnique({ where: { externalRef: event.externalRef } });
    if (seen) return seen;

    const payment = await this.prisma.payment.create({
      data: {
        externalRef: event.externalRef,
        source: event.source,
        amountMinor: event.amountMinor,
        status: "PENDING",
        ...(event.rawPayload !== undefined ? { rawPayload: event.rawPayload as object } : {}),
      },
    });

    const invoice = event.reference
      ? await this.prisma.invoice.findUnique({
          where: { reference: event.reference },
          include: { subscription: true },
        })
      : null;

    // شروط المطابقة: فاتورة مفتوحة بنفس المرجع وبمبلغ مطابق تماماً.
    const matches = invoice && invoice.status === "OPEN" && invoice.amountMinor === event.amountMinor;
    if (!matches) {
      this.logger.warn(`دفعة غير مطابقة → استثناء: ${event.externalRef}`);
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "EXCEPTION" },
      });
    }

    // مطابق: قيد التحصيل + تفعيل آلي للاشتراك والمتجر، ذرّياً.
    await this.ledger.post({
      idempotencyKey: `subscription-pay:${invoice.reference}`,
      description: `تحصيل اشتراك مُطابَق ${invoice.reference}`,
      reference: invoice.reference,
      postings: [
        { accountCode: PlatformAccounts.COD_CLEARING, side: "DEBIT", amountMinor: event.amountMinor },
        {
          accountCode: PlatformAccounts.REVENUE_SUBSCRIPTION,
          side: "CREDIT",
          amountMinor: event.amountMinor,
        },
      ],
    });

    const merchantId = invoice.subscription.merchantId;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "ACTIVE" },
      });
      // إعادة التفعيل الآلي: المتجر يعود ظاهراً فوراً.
      await tx.merchant.update({ where: { id: merchantId }, data: { status: "ACTIVE" } });
      await tx.store.updateMany({ where: { merchantId }, data: { isVisible: true } });
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: "MATCHED", matchedRef: invoice.reference, matchedAt: new Date(), invoiceId: invoice.id },
      });
    });

    this.logger.log(`دفعة مُطابَقة وتفعيل آلي: ${invoice.reference}`);
    return updated;
  }

  /** طابور الاستثناءات الصغير للمراجعة البشرية. */
  async listExceptions(): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { status: "EXCEPTION" },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  }
}
