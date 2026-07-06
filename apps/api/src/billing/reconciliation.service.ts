import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { NotificationsService } from "../notifications/notifications.service";
import { TEMPLATES } from "../notifications/templates";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "./billing.service";

const QUEUE = "payments-ingest";

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null as null,
  };
}

export interface IngestInput {
  source: "AGGREGATOR" | "MEPS" | "WALLET_RTP" | "BANK_FEED" | "MANUAL";
  externalId: string;
  reference?: string;
  amount: number | string;
  payload?: unknown;
}

/**
 * محرك المطابقة الآلية (القسم 24.1 بالملحق):
 * كل الأحداث الواردة (callbacks المُجمِّع، تسوية MEPS، feed بنكي، رفع يدوي)
 * تدخل طابور ابتلاع واحد، وتُطابَق بالمرجع الفريد — idempotent بالكامل.
 * مطابق → تفعيل آلي + واتساب. غامض → طابور استثناءات (الهدف < 5%).
 */
@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Reconciliation");
  private queue: Queue<{ eventId: string }>;
  private worker: Worker<{ eventId: string }>;

  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker(
      QUEUE,
      async (job) => this.process(job.data.eventId),
      { connection },
    );
    this.worker.on("failed", (job, err) =>
      this.logger.error(`فشل معالجة حدث دفع ${job?.data.eventId}: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** نقطة دخول كل الأحداث — idempotent بـ (المصدر + المعرف الخارجي) */
  async ingest(input: IngestInput) {
    try {
      const event = await this.prisma.paymentEvent.create({
        data: {
          source: input.source,
          externalId: input.externalId,
          reference: input.reference?.trim().toUpperCase(),
          amount: new Prisma.Decimal(input.amount),
          payload: (input.payload ?? undefined) as any,
        },
      });
      await this.queue.add("match", { eventId: event.id }, { removeOnComplete: true });
      return { accepted: true, eventId: event.id, duplicate: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // «تكرار الإشعار لا يُفعّل الاشتراك مرتين» — القسم 24.1
        return { accepted: true, duplicate: true };
      }
      throw e;
    }
  }

  /** المطابقة الفعلية */
  private async process(eventId: string) {
    const event = await this.prisma.paymentEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== "RECEIVED") return;

    const done = (
      status: "MATCHED" | "EXCEPTION" | "DUPLICATE",
      error?: string,
      matchedInvoiceId?: string,
    ) =>
      this.prisma.paymentEvent.update({
        where: { id: eventId },
        data: { status, error, matchedInvoiceId, processedAt: new Date() },
      });

    const ref = event.reference;
    if (!ref) {
      await done("EXCEPTION", "بلا مرجع — يتطلب مراجعة يدوية");
      return;
    }

    // 1) مطابقة فاتورة اشتراك بالمرجع
    const invoice = await this.prisma.invoice.findUnique({ where: { reference: ref } });
    if (invoice) {
      if (invoice.status === "PAID") {
        await done("EXCEPTION", "الفاتورة مسدَّدة سابقاً — دفعة زائدة تحتاج مراجعة", invoice.id);
        return;
      }
      if (new Prisma.Decimal(event.amount).lt(invoice.amount)) {
        await done(
          "EXCEPTION",
          `المبلغ (${event.amount}) أقل من قيمة الفاتورة (${invoice.amount})`,
          invoice.id,
        );
        return;
      }
      await this.billing.settleInvoice(invoice.id, event.source);
      // فائض الدفع يُقيَّد للمحفظة — لا يضيع ريال على التاجر
      const excess = new Prisma.Decimal(event.amount).sub(invoice.amount);
      if (excess.gt(0)) {
        await this.billing.creditWallet(
          invoice.storeId,
          excess,
          "CREDIT",
          `فائض سداد الفاتورة ${invoice.reference}`,
          `excess-${event.id}`,
          event.id,
        );
      }
      await done("MATCHED", undefined, invoice.id);
      this.logger.log(`✅ طُوبقت دفعة ${ref} وفُعّل الاشتراك آلياً`);
      return;
    }

    // 2) شحن محفظة: MOEEN-<كود التاجر>-W
    const walletMatch = ref.match(/^MOEEN-(\d+)-W$/);
    if (walletMatch) {
      const store = await this.prisma.store.findUnique({
        where: { billingCode: Number(walletMatch[1]) },
        include: { owner: true },
      });
      if (!store) {
        await done("EXCEPTION", "مرجع محفظة لتاجر غير موجود");
        return;
      }
      await this.billing.creditWallet(
        store.id,
        new Prisma.Decimal(event.amount),
        "TOPUP",
        `شحن محفظة عبر ${event.source}`,
        `topup-${event.id}`,
        event.id,
      );
      const fresh = await this.prisma.store.findUniqueOrThrow({ where: { id: store.id } });
      await this.notifications.enqueue({
        storeId: store.id,
        recipient: store.owner.phone,
        template: "WALLET_TOPUP",
        body: TEMPLATES.WALLET_TOPUP(
          store.owner.name ?? store.name,
          `${Number(event.amount).toLocaleString("ar-YE")} ريال`,
          `${Number(fresh.walletBalance).toLocaleString("ar-YE")} ريال`,
        ),
      });
      // الشلال: الرصيد الجديد يسدد أقدم فاتورة معلّقة تلقائياً
      await this.billing.attemptAutoPayFromWallet(store.id);
      await done("MATCHED");
      this.logger.log(`✅ شُحنت محفظة ${store.slug} بمبلغ ${event.amount}`);
      return;
    }

    await done("EXCEPTION", "مرجع غير معروف — لا يطابق فاتورة ولا محفظة");
  }

  /** طابور الاستثناءات — للمراجعة (لوحة الإدارة لاحقاً) */
  listExceptions(take = 50) {
    return this.prisma.paymentEvent.findMany({
      where: { status: "EXCEPTION" },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
