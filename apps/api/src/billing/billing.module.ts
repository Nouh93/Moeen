import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { NotificationsModule } from "../notifications/notifications.module";
import { StoresModule } from "../stores/stores.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { ReconciliationService } from "./reconciliation.service";

const QUEUE = "billing-cron";

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null as null,
  };
}

/** جدولة الدورة اليومية (فواتير التجديد + الإنذارات) عبر BullMQ repeatable */
@Injectable()
class BillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("BillingScheduler");
  private queue: Queue;
  private worker: Worker;

  constructor(private billing: BillingService) {}

  async onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker(QUEUE, async () => this.billing.runDailyCycle(), {
      connection,
    });
    // كل يوم 00:30 — القسم 24.4
    await this.queue.upsertJobScheduler("daily-billing", {
      pattern: "30 0 * * *",
    });
    this.logger.log("جدولة الفوترة اليومية مفعّلة (00:30)");
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}

@Module({
  imports: [StoresModule, NotificationsModule],
  controllers: [BillingController],
  providers: [BillingService, ReconciliationService, BillingScheduler],
  exports: [BillingService],
})
export class BillingModule {}
