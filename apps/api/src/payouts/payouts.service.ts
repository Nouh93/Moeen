import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Payout } from "@prisma/client";
import { InsufficientFundsError } from "@moeen/ledger";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { merchantSettlement, PlatformAccounts } from "../ledger/accounts.js";

/**
 * صرف مستحقات التاجر (Payout) — يُغلق الدورة المالية:
 *  - طلب السحب: يُحجز المبلغ من رصيد التسوية إلى «مستحقات سحب» (لا يُسمح بسحب أكثر
 *    من الرصيد — منع السالب على التسوية). يُنشأ سجل PENDING.
 *  - تأكيد الصرف (مشرف): يُحوّل من «مستحقات السحب» إلى النقد (المال يغادر فعلاً).
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  /** رصيد التسوية القابل للسحب. */
  async availableMinor(merchantId: string): Promise<bigint> {
    return this.ledger.balanceOf(merchantSettlement(merchantId)).catch(() => 0n);
  }

  async request(merchantId: string, amountMinor: bigint): Promise<Payout> {
    if (amountMinor <= 0n) throw new BadRequestException("المبلغ غير صالح");
    await this.accounts.ensurePlatform();
    await this.accounts.ensureMerchant(merchantId);

    const payoutId = randomUUID();
    // حجز المبلغ من التسوية → مستحقات السحب. يُرفض ذرّياً إن تجاوز الرصيد.
    try {
      await this.ledger.post({
        idempotencyKey: `payout-request:${payoutId}`,
        description: `طلب سحب للتاجر ${merchantId}`,
        reference: payoutId,
        postings: [
          { accountCode: merchantSettlement(merchantId), side: "DEBIT", amountMinor },
          { accountCode: PlatformAccounts.PAYABLE_PAYOUTS, side: "CREDIT", amountMinor },
        ],
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw new BadRequestException("الرصيد القابل للسحب لا يكفي");
      }
      throw error;
    }

    return this.prisma.payout.create({
      data: { id: payoutId, merchantId, amountMinor, status: "PENDING" },
    });
  }

  /** تأكيد الصرف الفعلي (مشرف): مستحقات السحب → نقد خارج. */
  async markPaid(payoutId: string, method?: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException("طلب السحب غير موجود");
    if (payout.status === "PAID") return payout;
    if (payout.status === "CANCELLED") throw new BadRequestException("طلب ملغى");

    await this.ledger.post({
      idempotencyKey: `payout-paid:${payoutId}`,
      description: `صرف سحب ${payoutId}`,
      reference: payoutId,
      postings: [
        { accountCode: PlatformAccounts.PAYABLE_PAYOUTS, side: "DEBIT", amountMinor: payout.amountMinor },
        { accountCode: PlatformAccounts.CASH, side: "CREDIT", amountMinor: payout.amountMinor },
      ],
    });

    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: "PAID", paidAt: new Date(), ...(method ? { method } : {}) },
    });
  }

  async listByMerchant(merchantId: string): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async listPending(): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { merchant: { select: { businessName: true } } },
    });
  }
}
