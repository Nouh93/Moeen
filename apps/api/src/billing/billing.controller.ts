import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { GatewayRegistry } from "../payments/gateway.registry.js";
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
    private readonly gateways: GatewayRegistry,
    private readonly ownership: OwnershipService,
  ) {}

  /**
   * استقبال إشعار دفع موقّع من مزوّد محدّد. يُتحقّق من توقيع HMAC على الجسم الخام
   * قبل القبول، ثم يُطبَّع ويدخل طابور الابتلاع الموحّد.
   */
  @Post("webhooks/payments/:provider")
  receiveSigned(
    @Param("provider") provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const gateway = this.gateways.get(provider);
    if (!gateway.configured) {
      throw new BadRequestException(`مزوّد "${provider}" غير مُهيَّأ بعد (سرّ مفقود)`);
    }
    const raw = req.rawBody;
    const signature = req.headers["x-moeen-signature"] as string | undefined;
    if (!raw || !gateway.verifySignature(raw, signature)) {
      throw new UnauthorizedException("توقيع الإشعار غير صالح");
    }
    return this.ingest.submit(gateway.normalize(req.body));
  }

  /** نقطة رفع يدوي بلا توقيع — للمشرفين فقط. */
  @Post("webhooks/payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  receivePayment(@Body() dto: PaymentWebhookDto) {
    return this.ingest.submit({
      externalRef: dto.externalRef,
      source: dto.source,
      amountMinor: BigInt(dto.amountMinor),
      ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
    });
  }

  /** طابور الاستثناءات — للمشرفين. */
  @Get("billing/exceptions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  exceptions() {
    return this.reconciliation.listExceptions();
  }

  /** إنشاء اشتراك لتاجر — المالك أو المشرف. */
  @Post("merchants/:merchantId/subscription")
  @UseGuards(JwtAuthGuard)
  async createSubscription(
    @Param("merchantId") merchantId: string,
    @Body() dto: IssueInvoiceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    return this.subscriptions.createSubscription(merchantId, BigInt(dto.priceMinor));
  }

  /** إصدار فاتورة الشهر يدوياً — للمشرفين (تشغيلياً عبر الجدولة). */
  @Post("merchants/:merchantId/invoices/run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  issueInvoice(@Param("merchantId") merchantId: string) {
    return this.subscriptions.issueMonthlyInvoice(merchantId);
  }

  /** تشغيل دورة الإنذار يدوياً — للمشرفين. */
  @Post("billing/dunning/run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  runDunning() {
    return this.dunning.runCycle();
  }
}
