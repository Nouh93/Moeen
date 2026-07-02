import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { daysBetween, Dunning } from "./billing.constants.js";

export interface DunningSummary {
  reminders: Array<{ merchantId: string; reference: string; day: number }>;
  suspended: string[];
  closed: string[];
}

/**
 * دورة الإنذار والتعليق (PRD 24.4/24.5). تُدار آلياً بحالة الفواتير المفتوحة.
 * الدالة idempotent: تطبّق الحالة المتوقّعة حسب عمر الفاتورة، فاستدعاؤها مراراً
 * في اليوم نفسه يُعطي النتيجة نفسها.
 */
@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runCycle(now: Date = new Date()): Promise<DunningSummary> {
    const summary: DunningSummary = { reminders: [], suspended: [], closed: [] };

    const openInvoices = await this.prisma.invoice.findMany({
      where: { status: "OPEN" },
      include: { subscription: { include: { merchant: true } } },
    });

    for (const invoice of openInvoices) {
      const merchant = invoice.subscription.merchant;
      const age = daysBetween(invoice.issuedAt, now);
      const isNewMerchant = daysBetween(merchant.createdAt, now) < Dunning.NEW_MERCHANT_GRACE_DAYS;

      // تذكيرات (لا تغيّر الحالة) — تُسلَّم عبر واتساب لاحقاً.
      const reminderDays: number[] = [
        Dunning.REMINDER_1_DAY,
        Dunning.REMINDER_2_DAY,
        Dunning.FINAL_NOTICE_DAY,
      ];
      if (reminderDays.includes(age)) {
        summary.reminders.push({ merchantId: merchant.id, reference: invoice.reference, day: age });
      }

      if (isNewMerchant) continue; // إعفاء التاجر الجديد من التعليق/الإغلاق.

      if (age >= Dunning.CLOSE_DAY && merchant.status !== "CLOSED") {
        await this.closeMerchant(merchant.id);
        summary.closed.push(merchant.id);
      } else if (age >= Dunning.SUSPEND_DAY && age < Dunning.CLOSE_DAY && merchant.status === "ACTIVE") {
        await this.suspendMerchant(merchant.id);
        summary.suspended.push(merchant.id);
      }
    }

    this.logger.log(
      `دورة الإنذار: ${summary.reminders.length} تذكير، ${summary.suspended.length} تعليق، ${summary.closed.length} إغلاق`,
    );
    return summary;
  }

  private async suspendMerchant(merchantId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.merchant.update({ where: { id: merchantId }, data: { status: "SUSPENDED" } }),
      this.prisma.store.updateMany({ where: { merchantId }, data: { isVisible: false } }),
      this.prisma.subscription.updateMany({
        where: { merchantId, status: "ACTIVE" },
        data: { status: "PAST_DUE" },
      }),
    ]);
  }

  private async closeMerchant(merchantId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.merchant.update({ where: { id: merchantId }, data: { status: "CLOSED" } }),
      this.prisma.store.updateMany({ where: { merchantId }, data: { isVisible: false } }),
    ]);
  }
}
