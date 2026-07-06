import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PLANS } from "@moeen/shared";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { BillingService } from "./billing.service";
import { IngestInput, ReconciliationService } from "./reconciliation.service";

class SubscribeDto {
  @IsIn(["GROWTH", "PRO"])
  plan: "GROWTH" | "PRO";

  @IsIn([1, 12])
  months: 1 | 12;
}

class WebhookDto {
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsNumber()
  @Min(1)
  amount: number;
}

const WEBHOOK_SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? "dev-webhook-secret";
const SOURCES: Record<string, IngestInput["source"]> = {
  aggregator: "AGGREGATOR",
  meps: "MEPS",
  wallet: "WALLET_RTP",
  bank: "BANK_FEED",
  manual: "MANUAL",
};

@Controller()
export class BillingController {
  constructor(
    private billing: BillingService,
    private reconciliation: ReconciliationService,
  ) {}

  // ---- التاجر ----

  @UseGuards(JwtAuthGuard)
  @Get("stores/:id/billing")
  async summary(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    const summary = await this.billing.summary(id, u.sub);
    return { ...summary, plans: PLANS };
  }

  @UseGuards(JwtAuthGuard)
  @Post("stores/:id/billing/subscribe")
  subscribe(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.billing.subscribe(id, u.sub, dto.plan, dto.months);
  }

  // ---- webhooks الدفع (المُجمِّع / MEPS / بنك) — القسم 24.2 ----

  @Post("webhooks/payments/:source")
  webhook(
    @Param("source") source: string,
    @Headers("x-moeen-webhook-secret") secret: string,
    @Body() dto: WebhookDto,
  ) {
    if (secret !== WEBHOOK_SECRET) {
      throw new UnauthorizedException("توقيع webhook غير صحيح");
    }
    const mapped = SOURCES[source];
    if (!mapped) throw new ForbiddenException("مصدر غير مدعوم");
    return this.reconciliation.ingest({
      source: mapped,
      externalId: dto.externalId,
      reference: dto.reference,
      amount: dto.amount,
      payload: dto,
    });
  }

  // ---- أدوات تطوير (تُعطَّل في الإنتاج) ----

  /** تشغيل الدورة اليومية يدوياً للاختبار (تجديد + إنذار + تعليق) */
  @Post("billing/dev/run-cycle")
  devRunCycle() {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("غير متاح في الإنتاج");
    }
    return this.billing.runDailyCycle();
  }
}
