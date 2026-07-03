import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";

const QUEUE = "notifications";

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null as null,
  };
}

export interface NotificationJob {
  notificationId: string;
}

/**
 * كل إشعار يمر عبر طابور BullMQ بإعادة محاولة تصاعدية (1 دقيقة، 5 دقائق،
 * 30 دقيقة) — القسم 22.3.2 بالملحق. بعد 3 محاولات فاشلة تُعلَّم الرسالة
 * FAILED وتظهر في سجل الإشعارات للمراجعة.
 *
 * المزوّد الحالي (dev): يكتب الرسالة في السجل ويعلّمها SENT.
 * في الإنتاج: يُستبدل بمزوّد WhatsApp Business API (BSP) دون تغيير البنية،
 * مع SMS احتياطاً للرسائل الحرجة (القسم 10.2).
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Notifications");
  private queue: Queue<NotificationJob>;
  private worker: Worker<NotificationJob>;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker<NotificationJob>(
      QUEUE,
      async (job) => this.deliver(job.data.notificationId),
      { connection },
    );
    this.worker.on("failed", async (job, err) => {
      if (!job) return;
      await this.prisma.notification.update({
        where: { id: job.data.notificationId },
        data: {
          attempts: job.attemptsMade,
          lastError: err.message,
          ...(job.attemptsMade >= (job.opts.attempts ?? 1)
            ? { status: "FAILED" }
            : {}),
        },
      });
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** إنشاء إشعار وإدخاله الطابور */
  async enqueue(data: {
    storeId?: string;
    orderId?: string;
    recipient: string;
    template: string;
    body: string;
  }) {
    const notification = await this.prisma.notification.create({ data });
    await this.queue.add(
      "send",
      { notificationId: notification.id },
      {
        attempts: 3,
        // إعادة المحاولة: دقيقة ثم 5 دقائق ثم 30 (القسم 22.3.2)
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return notification;
  }

  /** التسليم الفعلي — مزوّد التطوير يكتب في السجل */
  private async deliver(notificationId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!n || n.status === "SENT") return;

    // TODO الإنتاج: استدعاء WhatsApp Business API هنا (قوالب معتمدة مسبقاً)
    this.logger.log(`[واتساب → ${n.recipient}] (${n.template})\n${n.body}`);

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  /** سجل إشعارات المتجر للوحة التاجر */
  listForStore(storeId: string, take = 50) {
    return this.prisma.notification.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
