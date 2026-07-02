import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { ReconciliationService } from "./reconciliation.service.js";
import { jobToEvent } from "./payment-ingest.service.js";
import { PAYMENTS_QUEUE } from "./redis.js";

/** عامل الطابور: يمرّر كل حدث دفع إلى محرّك المطابقة (idempotent). */
@Processor(PAYMENTS_QUEUE)
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(private readonly reconciliation: ReconciliationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const payment = await this.reconciliation.ingest(jobToEvent(job.data));
    this.logger.log(`عُولجت دفعة ${job.data.externalRef}: ${payment.status}`);
  }
}
