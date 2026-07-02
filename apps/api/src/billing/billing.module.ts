import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { LedgerModule } from "../ledger/ledger.module.js";
import { GatewayRegistry } from "../payments/gateway.registry.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { ReconciliationService } from "./reconciliation.service.js";
import { DunningService } from "./dunning.service.js";
import { PaymentIngestService } from "./payment-ingest.service.js";
import { PaymentsProcessor } from "./payments.processor.js";
import { BillingController } from "./billing.controller.js";
import { BillingScheduler } from "./billing.scheduler.js";
import { PAYMENTS_QUEUE, queueEnabled, redisConnection } from "./redis.js";

// الطوابير تُفعَّل فقط عند توفّر Redis (REDIS_URL) — وإلا يعمل النظام بمعالجة
// متزامنة (fallback) دون فشل في الإقلاع.
const queueImports = queueEnabled()
  ? [
      BullModule.forRoot({ connection: redisConnection() }),
      BullModule.registerQueue({ name: PAYMENTS_QUEUE }),
    ]
  : [];
const queueProviders = queueEnabled() ? [PaymentsProcessor] : [];

@Module({
  imports: [LedgerModule, ScheduleModule.forRoot(), ...queueImports],
  controllers: [BillingController],
  providers: [
    SubscriptionsService,
    ReconciliationService,
    DunningService,
    PaymentIngestService,
    BillingScheduler,
    GatewayRegistry,
    ...queueProviders,
  ],
  exports: [SubscriptionsService, ReconciliationService, DunningService],
})
export class BillingModule {}
