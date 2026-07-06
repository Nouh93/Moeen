import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DUNNING, PLANS, PlanId, planPrice } from "@moeen/shared";
import { NotificationsService } from "../notifications/notifications.service";
import { TEMPLATES } from "../notifications/templates";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

function fmtMoney(v: Prisma.Decimal | number): string {
  return `${Number(v).toLocaleString("ar-YE")} ريال`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" });
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * محرك الفوترة وتحصيل الاشتراك (القسم 24 بالملحق).
 * المبدأ الحاكم: «آلي بالأصل، يدوي للاستثناء فقط».
 * قاعدة الخصم: صافِ من المحفظة أولاً، وإلا فاتورة بمرجع فريد (wallet → invoice).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger("Billing");

  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
    private notifications: NotificationsService,
  ) {}

  /** مرجع فاتورة فريد عالمياً: MOEEN-<كود التاجر>-<سنةشهر> (القسم 24.1) */
  private async uniqueInvoiceReference(billingCode: number): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const base = `MOEEN-${billingCode}-${ym}`;
    for (let i = 0; ; i++) {
      const ref = i === 0 ? base : `${base}-${i + 1}`;
      const exists = await this.prisma.invoice.findUnique({ where: { reference: ref } });
      if (!exists) return ref;
    }
  }

  /** مرجع شحن المحفظة الثابت للتاجر: MOEEN-<كود>-W */
  static walletReference(billingCode: number): string {
    return `MOEEN-${billingCode}-W`;
  }

  // ---------- دفتر المحفظة (append-only — القسم 24.8) ----------

  /**
   * إيداع في المحفظة + قيد دفتر — idempotent بالمفتاح.
   * يُستدعى من محرك المطابقة عند وصول شحن رصيد أو فائض دفع.
   */
  async creditWallet(
    storeId: string,
    amount: Prisma.Decimal,
    type: "TOPUP" | "CREDIT",
    note: string,
    idempotencyKey: string,
    eventId?: string,
  ) {
    if (amount.lte(0)) return null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const store = await tx.store.update({
          where: { id: storeId },
          data: { walletBalance: { increment: amount } },
        });
        return tx.walletTransaction.create({
          data: {
            storeId,
            type,
            amount,
            balanceAfter: store.walletBalance,
            idempotencyKey,
            note,
            eventId,
          },
        });
      });
    } catch (e) {
      // مفتاح مكرر = قيد سابق لنفس الحدث — تجاهل آمن (idempotency)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return null;
      }
      throw e;
    }
  }

  /**
   * خصم من المحفظة داخل معاملة — يفشل بهدوء إن لم يكفِ الرصيد.
   * «لا يُسمح برصيد سالب إطلاقاً (الحد = 0)» — القسم 24.8.5.
   */
  private async chargeWalletTx(
    tx: Prisma.TransactionClient,
    storeId: string,
    amount: Prisma.Decimal,
    note: string,
    invoiceId: string,
  ): Promise<boolean> {
    const updated = await tx.store.updateMany({
      where: { id: storeId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    });
    if (updated.count === 0) return false;
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    await tx.walletTransaction.create({
      data: {
        storeId,
        type: "CHARGE",
        amount: amount.neg(),
        balanceAfter: store.walletBalance,
        idempotencyKey: `charge-${invoiceId}`,
        note,
        invoiceId,
      },
    });
    return true;
  }

  // ---------- التفعيل ----------

  /** تفعيل/تمديد الاشتراك بعد سداد فاتورة — داخل نفس المعاملة */
  private async activateTx(
    tx: Prisma.TransactionClient,
    invoice: { id: string; storeId: string; plan: string; months: number },
    paidVia: string,
  ) {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date(), paidVia },
    });
    const store = await tx.store.findUniqueOrThrow({ where: { id: invoice.storeId } });
    const base =
      store.currentPeriodEnd && store.currentPeriodEnd > new Date()
        ? store.currentPeriodEnd
        : new Date();
    return tx.store.update({
      where: { id: store.id },
      data: {
        plan: invoice.plan as any,
        currentPeriodEnd: addMonths(base, invoice.months),
        dunningStage: 0,
        // التعليق بسبب السداد يُرفع فوراً وآلياً (القسم 24.4)
        ...(store.status === "SUSPENDED" ? { status: "ACTIVE" as const } : {}),
      },
    });
  }

  /** سداد فاتورة (من أي مصدر) + تفعيل + إشعار — تُستدعى من محرك المطابقة */
  async settleInvoice(invoiceId: string, paidVia: string) {
    const store = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status === "PAID") return null;
      return this.activateTx(tx, invoice, paidVia);
    });
    if (store) await this.notifyActivation(store.id);
    return store;
  }

  private async notifyActivation(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { owner: true },
    });
    const lastPaid = await this.prisma.invoice.findFirst({
      where: { storeId, status: "PAID" },
      orderBy: { paidAt: "desc" },
    });
    if (!lastPaid || !store.currentPeriodEnd) return;
    await this.notifications.enqueue({
      storeId,
      recipient: store.owner.phone,
      template: "PAYMENT_RECEIVED",
      body: TEMPLATES.PAYMENT_RECEIVED(
        store.owner.name ?? store.name,
        fmtMoney(lastPaid.amount),
        fmtDate(store.currentPeriodEnd),
      ),
    });
  }

  /** الشلال بعد أي إيداع للمحفظة: سدّد أقدم فاتورة معلّقة ما دام الرصيد يكفي */
  async attemptAutoPayFromWallet(storeId: string) {
    for (;;) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { storeId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      if (!invoice) return;
      const paid = await this.prisma.$transaction(async (tx) => {
        const ok = await this.chargeWalletTx(
          tx,
          storeId,
          invoice.amount,
          `سداد فاتورة ${invoice.reference} من المحفظة`,
          invoice.id,
        );
        if (!ok) return false;
        await this.activateTx(tx, invoice, "WALLET");
        return true;
      });
      if (!paid) return;
      await this.notifyActivation(storeId);
    }
  }

  // ---------- الاشتراك والترقية (القسم 3.3) ----------

  async subscribe(storeId: string, ownerId: string, plan: PlanId, months: 1 | 12) {
    const store = await this.stores.ownedByOrThrow(storeId, ownerId);
    if (plan === "FREE" || !PLANS[plan]) {
      throw new BadRequestException("اختر باقة مدفوعة (نمو أو احتراف)");
    }
    const amount = D(planPrice(plan, months));

    // فاتورة معلّقة سابقة لنفس الطلب؟ أعدها بدل التكرار
    const existing = await this.prisma.invoice.findFirst({
      where: { storeId, status: "PENDING", plan: plan as any, months },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { paid: false, invoice: existing, walletCovered: false };
    }

    const reference = await this.uniqueInvoiceReference(store.billingCode);
    const periodStart = new Date();
    const invoice = await this.prisma.invoice.create({
      data: {
        storeId,
        reference,
        plan: plan as any,
        months,
        amount,
        periodStart,
        periodEnd: addMonths(periodStart, months),
      },
    });

    // الشلال: المحفظة أولاً (القسم 24.8) — وإلا فاتورة بمرجع للسداد عبر أي محفظة
    const paid = await this.prisma.$transaction(async (tx) => {
      const ok = await this.chargeWalletTx(
        tx,
        storeId,
        amount,
        `اشتراك ${PLANS[plan].nameAr} (${months} ${months === 1 ? "شهر" : "شهراً"})`,
        invoice.id,
      );
      if (!ok) return false;
      await this.activateTx(tx, invoice, "WALLET");
      return true;
    });

    if (paid) {
      await this.notifyActivation(storeId);
    } else {
      const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
      await this.notifications.enqueue({
        storeId,
        recipient: owner.phone,
        template: "INVOICE_ISSUED",
        body: TEMPLATES.INVOICE_ISSUED(
          owner.name ?? store.name,
          fmtMoney(amount),
          reference,
          `${WEB_URL}/dashboard`,
        ),
      });
    }

    const fresh = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    return { paid, invoice: fresh, walletCovered: paid };
  }

  // ---------- ملخص الفوترة للوحة ----------

  async summary(storeId: string, ownerId: string) {
    const store = await this.stores.ownedByOrThrow(storeId, ownerId);
    const [invoices, ledger] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      this.prisma.walletTransaction.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return {
      plan: store.plan,
      status: store.status,
      currentPeriodEnd: store.currentPeriodEnd,
      walletBalance: store.walletBalance,
      walletReference: BillingService.walletReference(store.billingCode),
      billingCode: store.billingCode,
      dunningStage: store.dunningStage,
      invoices,
      ledger,
    };
  }

  // ---------- الدورة اليومية: تجديد + إنذار (القسم 24.4) ----------

  async runDailyCycle() {
    const now = new Date();
    let issued = 0,
      reminded = 0,
      suspended = 0,
      closed = 0;

    const paidStores = await this.prisma.store.findMany({
      where: {
        plan: { not: "FREE" },
        status: { not: "CLOSED" },
        currentPeriodEnd: { not: null },
      },
      include: { owner: true },
    });

    for (const store of paidStores) {
      const periodEnd = store.currentPeriodEnd!;
      if (periodEnd > now) continue; // الاشتراك ساري

      // 1) فاتورة تجديد إن لم توجد فاتورة معلّقة
      let invoice = await this.prisma.invoice.findFirst({
        where: { storeId: store.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      if (!invoice) {
        const reference = await this.uniqueInvoiceReference(store.billingCode);
        invoice = await this.prisma.invoice.create({
          data: {
            storeId: store.id,
            reference,
            plan: store.plan,
            months: 1,
            amount: D(planPrice(store.plan as PlanId, 1)),
            periodStart: periodEnd,
            periodEnd: addMonths(periodEnd, 1),
          },
        });
        issued++;
        // جرّب المحفظة أولاً — تجديد صفري التدخّل (القسم 24.3)
        await this.attemptAutoPayFromWallet(store.id);
        const stillPending = await this.prisma.invoice.findUnique({ where: { id: invoice.id } });
        if (stillPending?.status === "PAID") continue;
        await this.notifications.enqueue({
          storeId: store.id,
          recipient: store.owner.phone,
          template: "INVOICE_ISSUED",
          body: TEMPLATES.INVOICE_ISSUED(
            store.owner.name ?? store.name,
            fmtMoney(invoice.amount),
            invoice.reference,
            `${WEB_URL}/dashboard`,
          ),
        });
        continue;
      }

      // 2) دورة الإنذار — أيام منذ الاستحقاق
      const daysOverdue = Math.floor((now.getTime() - periodEnd.getTime()) / 86_400_000);
      const merchantAgeDays = Math.floor((now.getTime() - store.createdAt.getTime()) / 86_400_000);
      // تاجر جديد: أول شهرين لا تعليق (القسم 24.5)
      const protectedNew = merchantAgeDays < DUNNING.NEW_MERCHANT_PROTECTION_DAYS;

      const notify = (template: string, body: string) =>
        this.notifications.enqueue({
          storeId: store.id,
          recipient: store.owner.phone,
          template,
          body,
        });
      const name = store.owner.name ?? store.name;
      const money = fmtMoney(invoice.amount);

      if (daysOverdue >= DUNNING.CLOSE && store.dunningStage >= 4) {
        await this.prisma.store.update({
          where: { id: store.id },
          data: { status: "CLOSED", dunningStage: 5 },
        });
        closed++;
        this.logger.warn(`متجر أُغلق لعدم السداد: ${store.slug} (تُحفظ بياناته 90 يوماً)`);
      } else if (daysOverdue >= DUNNING.FINAL_NOTICE && store.dunningStage < 4) {
        await this.prisma.store.update({ where: { id: store.id }, data: { dunningStage: 4 } });
        await notify(
          "SUBSCRIPTION_REMINDER",
          TEMPLATES.SUBSCRIPTION_REMINDER(name, money, invoice.reference, 0) +
            `\n⚠️ إشعار نهائي: سيُغلق الحساب خلال ${DUNNING.CLOSE - DUNNING.FINAL_NOTICE} أيام`,
        );
        reminded++;
      } else if (daysOverdue >= DUNNING.SUSPEND && store.dunningStage < 3 && !protectedNew) {
        await this.prisma.store.update({
          where: { id: store.id },
          data: { status: "SUSPENDED", dunningStage: 3 },
        });
        await notify(
          "STORE_SUSPENDED",
          TEMPLATES.STORE_SUSPENDED(name, money, invoice.reference),
        );
        suspended++;
      } else if (daysOverdue >= DUNNING.REMINDER_2 && store.dunningStage < 2) {
        await this.prisma.store.update({ where: { id: store.id }, data: { dunningStage: 2 } });
        await notify(
          "SUBSCRIPTION_REMINDER",
          TEMPLATES.SUBSCRIPTION_REMINDER(name, money, invoice.reference, DUNNING.SUSPEND - daysOverdue),
        );
        reminded++;
      } else if (daysOverdue >= DUNNING.REMINDER_1 && store.dunningStage < 1) {
        await this.prisma.store.update({ where: { id: store.id }, data: { dunningStage: 1 } });
        await notify(
          "SUBSCRIPTION_REMINDER",
          TEMPLATES.SUBSCRIPTION_REMINDER(name, money, invoice.reference, DUNNING.SUSPEND - daysOverdue),
        );
        reminded++;
      }
    }

    const result = { issued, reminded, suspended, closed };
    this.logger.log(`الدورة اليومية: ${JSON.stringify(result)}`);
    return result;
  }
}
