import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { PaymentSource } from "@prisma/client";
import type { PaymentEvent } from "../billing/reconciliation.service.js";
import type { PaymentGateway } from "./gateway.port.js";

/**
 * بوابة عامة تتحقّق من توقيع HMAC-SHA256 على الجسم الخام، وتُطبّع حمولة قياسية.
 * صالحة كأساس لمعظم المزوّدين (eSadad/WeNet/المحافظ) الذين يوقّعون الـwebhook بسرّ مشترك.
 * عند توفّر مواصفات مزوّد بعينه (حقول/توقيع مختلف) يُشتقّ adapter خاص منها.
 */
export class HmacGateway implements PaymentGateway {
  constructor(
    readonly source: PaymentSource,
    private readonly secret: string | undefined,
  ) {}

  get configured(): boolean {
    return !!this.secret;
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.secret) return false; // غير مُهيَّأ → لا نقبل
    if (!signature) return false;
    const expected = createHmac("sha256", this.secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  normalize(payload: unknown): PaymentEvent {
    const p = payload as Record<string, unknown>;
    const externalRef = typeof p.externalRef === "string" ? p.externalRef : undefined;
    const amountRaw = p.amountMinor;
    if (!externalRef) throw new BadRequestException("externalRef مفقود في حمولة المزوّد");
    let amountMinor: bigint;
    try {
      amountMinor = BigInt(String(amountRaw));
    } catch {
      throw new BadRequestException("amountMinor غير صالح");
    }
    return {
      externalRef,
      source: this.source,
      amountMinor,
      ...(typeof p.reference === "string" ? { reference: p.reference } : {}),
      rawPayload: payload,
    };
  }
}
