import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PaymentIngestService } from "./payment-ingest.service.js";
import { ReconciliationService } from "./reconciliation.service.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { DunningService } from "./dunning.service.js";
import { IssueInvoiceDto, PaymentWebhookDto } from "./dto.js";

@Controller()
export class BillingController {
  constructor(
    private readonly ingest: PaymentIngestService,
    private readonly reconciliation: ReconciliationService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dunning: DunningService,
  ) {}

  /**
   * نقطة استقبال إشعارات الدفع (المُجمِّع/MEPS/البنك…). عامة — يجب التحقّق من
   * توقيع المزوّد في الإنتاج. تدخل كلها طابور الابتلاع الموحّد.
   */
  @Post("webhooks/payments")
  receivePayment(@Body() dto: PaymentWebhookDto) {
    return this.ingest.submit({
      externalRef: dto.externalRef,
      source: dto.source,
      amountMinor: BigInt(dto.amountMinor),
      ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
    });
  }

  /** طابور الاستثناءات (للموظف). */
  @Get("billing/exceptions")
  @UseGuards(JwtAuthGuard)
  exceptions() {
    return this.reconciliation.listExceptions();
  }

  /** إنشاء اشتراك لتاجر. */
  @Post("merchants/:merchantId/subscription")
  @UseGuards(JwtAuthGuard)
  createSubscription(@Param("merchantId") merchantId: string, @Body() dto: IssueInvoiceDto) {
    return this.subscriptions.createSubscription(merchantId, BigInt(dto.priceMinor));
  }

  /** إصدار فاتورة الشهر يدوياً (تشغيلياً عبر الجدولة). */
  @Post("merchants/:merchantId/invoices/run")
  @UseGuards(JwtAuthGuard)
  issueInvoice(@Param("merchantId") merchantId: string) {
    return this.subscriptions.issueMonthlyInvoice(merchantId);
  }

  /** تشغيل دورة الإنذار يدوياً (تشغيلياً عبر الجدولة اليومية). */
  @Post("billing/dunning/run")
  @UseGuards(JwtAuthGuard)
  runDunning() {
    return this.dunning.runCycle();
  }
}
