import { Injectable, NotFoundException } from "@nestjs/common";
import { HmacGateway } from "./hmac.gateway.js";
import type { PaymentGateway } from "./gateway.port.js";

/**
 * سجلّ بوابات الدفع حسب مفتاح المزوّد في المسار (/webhooks/payments/:provider).
 * الأسرار تُقرأ من البيئة؛ يبقى المزوّد "غير مُهيَّأ" حتى يُضبَط سرّه (بعد onboarding التجاري).
 */
@Injectable()
export class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>([
    ["meps", new HmacGateway("MEPS_SETTLEMENT", process.env.MEPS_WEBHOOK_SECRET)],
    ["aggregator", new HmacGateway("AGGREGATOR", process.env.AGGREGATOR_WEBHOOK_SECRET)],
    ["wallet", new HmacGateway("WALLET_API", process.env.WALLET_WEBHOOK_SECRET)],
    ["bank", new HmacGateway("BANK_TRANSFER", process.env.BANK_WEBHOOK_SECRET)],
  ]);

  get(provider: string): PaymentGateway {
    const gateway = this.gateways.get(provider.toLowerCase());
    if (!gateway) throw new NotFoundException(`مزوّد دفع غير معروف: ${provider}`);
    return gateway;
  }
}
