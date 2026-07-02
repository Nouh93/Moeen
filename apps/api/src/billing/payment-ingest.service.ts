import { Injectable, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { PaymentSource } from "@prisma/client";
import { ReconciliationService, type PaymentEvent } from "./reconciliation.service.js";
import { PAYMENTS_QUEUE } from "./redis.js";

/** صيغة النقل عبر الطابور (BullMQ لا يُسلسل bigint → المبلغ كنصّ). */
interface PaymentJob {
  externalRef: string;
  source: PaymentSource;
  amountMinor: string;
  reference?: string;
  rawPayload?: unknown;
}

/**
 * طابور الابتلاع الموحّد (PRD 24.1): كل الأحداث الواردة تدخل من هنا.
 * إن توفّر Redis تُوضع في الطابور (معالجة غير متزامنة قابلة لإعادة المحاولة)؛
 * وإلا تُعالَج مباشرةً (fallback) كي يعمل النظام بلا Redis في بيئات بسيطة.
 */
@Injectable()
export class PaymentIngestService {
  constructor(
    @Optional() @InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue | undefined,
    private readonly reconciliation: ReconciliationService,
  ) {}

  async submit(event: PaymentEvent): Promise<{ queued: boolean; status?: string }> {
    if (this.queue) {
      const job: PaymentJob = {
        externalRef: event.externalRef,
        source: event.source,
        amountMinor: event.amountMinor.toString(),
        ...(event.reference !== undefined ? { reference: event.reference } : {}),
        ...(event.rawPayload !== undefined ? { rawPayload: event.rawPayload } : {}),
      };
      // jobId = externalRef يمنع ازدواج الإدخال على مستوى الطابور أيضاً.
      await this.queue.add("ingest", job, { jobId: event.externalRef, removeOnComplete: true });
      return { queued: true };
    }
    const payment = await this.reconciliation.ingest(event);
    return { queued: false, status: payment.status };
  }
}

export function jobToEvent(job: PaymentJob): PaymentEvent {
  return {
    externalRef: job.externalRef,
    source: job.source,
    amountMinor: BigInt(job.amountMinor),
    ...(job.reference !== undefined ? { reference: job.reference } : {}),
    ...(job.rawPayload !== undefined ? { rawPayload: job.rawPayload } : {}),
  };
}
