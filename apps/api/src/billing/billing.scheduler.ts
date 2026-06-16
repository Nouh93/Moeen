import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { DunningService } from "./dunning.service.js";

/**
 * جدولة آلية: دورة الإنذار يومياً، وإصدار فواتير الاشتراك أول كل شهر.
 * المنطق كله idempotent، فلا ضرر من التشغيل المتكرر.
 */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dunning: DunningService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyDunning(): Promise<void> {
    await this.dunning.runCycle(new Date());
  }

  @Cron("0 1 1 * *") // الساعة 1 صباحاً أول كل شهر
  async monthlyInvoices(): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "PAST_DUE"] } },
      select: { merchantId: true },
    });
    const now = new Date();
    for (const sub of subs) {
      try {
        await this.subscriptions.issueMonthlyInvoice(sub.merchantId, now);
      } catch (error) {
        this.logger.error(`فشل إصدار فاتورة للتاجر ${sub.merchantId}: ${String(error)}`);
      }
    }
  }
}
