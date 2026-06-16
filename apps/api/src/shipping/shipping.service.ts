import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Order, Shipment } from "@prisma/client";
import { InsufficientFundsError } from "@moeen/ledger";
import { PrismaService } from "../prisma/prisma.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { LedgerService, type PostingInput } from "../ledger/ledger.service.js";
import {
  merchantHold,
  merchantSettlement,
  merchantWallet,
  PlatformAccounts,
} from "../ledger/accounts.js";
import { PricingService } from "../orders/pricing.js";
import { nonZero } from "../orders/orders.service.js";

/**
 * إدارة الشحنات (البوالص) والتسوية المالية المرتبطة بها — تطبيق دقيق لـ PRD 24.8.3/4/5:
 *
 *  • إنشاء البوليصة = **حجز (hold)** فقط (للشحن الذي يتحمّله التاجر على طلب إلكتروني):
 *    يُحجز الشحن من رصيد المدفوعات ثم المحفظة (waterfall). إن لم يكفِ → **تُرفض البوليصة**
 *    (لا رصيد سالب).
 *  • تأكيد التسليم = **خصم فعلي وتسوية**:
 *    - COD: تُقيَّد التسوية من تحصيل النقد (الشحن يُصافى من COD إن تحمّله التاجر).
 *    - إلكتروني يتحمّله التاجر: يُحوَّل الحجز إلى مستحقّ شركة الشحن.
 *  • الإلغاء = **تحرير الحجز** (يعود للمحفظة).
 */
@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
    private readonly pricing: PricingService,
  ) {}

  private async loadOrderWithMerchant(orderId: string): Promise<{ order: Order; merchantId: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { merchantId: true } } },
    });
    if (!order) throw new NotFoundException("الطلب غير موجود");
    return { order, merchantId: order.store.merchantId };
  }

  /**
   * إنشاء بوليصة. idempotent عبر تفرّد الشحنة على الطلب.
   * يحجز الشحن (إن لزم) **قبل** إنشاء سجل الشحنة — فإن فشل الحجز لا تُنشأ بوليصة.
   */
  async createWaybill(orderId: string): Promise<Shipment> {
    const existing = await this.prisma.shipment.findUnique({ where: { orderId } });
    if (existing) return existing;

    const { order, merchantId } = await this.loadOrderWithMerchant(orderId);
    await this.accounts.ensurePlatform();
    await this.accounts.ensureMerchant(merchantId);

    // حجز الشحن للشحن الإلكتروني الذي يتحمّله التاجر (COD يُصافى من التحصيل لاحقاً).
    if (order.merchantPaysShipping && order.paymentMethod === "ONLINE" && order.shippingMinor > 0n) {
      await this.reserveShipping(merchantId, order.shippingMinor, order.id);
    }

    return this.prisma.shipment.create({
      data: {
        orderId,
        status: "CREATED",
        waybillNumber: `MOEEN-WB-${randomUUID().slice(0, 8).toUpperCase()}`,
        costMinor: order.shippingMinor,
      },
    });
  }

  /**
   * تأكيد التسليم: الخصم الفعلي والتسوية، ثم تحديث حالتي الشحنة والطلب.
   * idempotent: إعادة التأكيد لا تُكرّر القيود (مفاتيح فريدة) ولا تغيّر الحالة.
   */
  async confirmDelivery(orderId: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({ where: { orderId } });
    if (!shipment) throw new NotFoundException("لا توجد بوليصة لهذا الطلب");
    if (shipment.status === "DELIVERED") return shipment;
    if (shipment.status === "CANCELLED" || shipment.status === "RETURNED") {
      throw new BadRequestException("لا يمكن تسليم بوليصة ملغاة أو مُرجَعة");
    }

    const { order, merchantId } = await this.loadOrderWithMerchant(orderId);

    if (order.paymentMethod === "COD") {
      await this.settleCod(order, merchantId);
    } else if (order.merchantPaysShipping && order.shippingMinor > 0n) {
      // إلكتروني يتحمّله التاجر: حوّل الحجز إلى مستحقّ شركة الشحن (خصم فعلي).
      await this.captureHold(merchantId, order.shippingMinor, order.id);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
      return tx.shipment.update({
        where: { orderId },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    });
  }

  /** إلغاء البوليصة قبل التسليم: تحرير الحجز (إن وُجد) وإرجاعه للمحفظة. */
  async cancel(orderId: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({ where: { orderId } });
    if (!shipment) throw new NotFoundException("لا توجد بوليصة لهذا الطلب");
    if (shipment.status === "DELIVERED") throw new BadRequestException("الطلب سُلّم بالفعل");
    if (shipment.status === "CANCELLED") return shipment;

    const { order, merchantId } = await this.loadOrderWithMerchant(orderId);
    if (order.merchantPaysShipping && order.paymentMethod === "ONLINE" && order.shippingMinor > 0n) {
      await this.releaseHold(merchantId, order.shippingMinor, order.id);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      return tx.shipment.update({ where: { orderId }, data: { status: "CANCELLED" } });
    });
  }

  // ───────────────────────── العمليات المالية الداخلية ─────────────────────────

  /** حجز مبلغ الشحن وفق waterfall: رصيد المدفوعات ← المحفظة. يرفض إن لم يكفِ المجموع. */
  private async reserveShipping(merchantId: string, amount: bigint, ref: string): Promise<void> {
    const settlementBal = await this.ledger.balanceOf(merchantSettlement(merchantId));
    const fromSettlement = settlementBal >= amount ? amount : settlementBal;
    const fromWallet = amount - fromSettlement;

    const postings: PostingInput[] = nonZero([
      { accountCode: merchantSettlement(merchantId), side: "DEBIT", amountMinor: fromSettlement },
      { accountCode: merchantWallet(merchantId), side: "DEBIT", amountMinor: fromWallet },
      { accountCode: merchantHold(merchantId), side: "CREDIT", amountMinor: amount },
    ]);

    try {
      await this.ledger.post({
        idempotencyKey: `ship-hold:${ref}`,
        description: `حجز شحن للطلب ${ref}`,
        reference: ref,
        postings,
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw new BadRequestException(
          "رصيد التاجر لا يكفي لتغطية الشحن — يجب شحن المحفظة قبل إنشاء البوليصة",
        );
      }
      throw error;
    }
  }

  /** عند التسليم: تحويل الحجز إلى مستحقّ شركة الشحن (خصم فعلي). */
  private async captureHold(merchantId: string, amount: bigint, ref: string): Promise<void> {
    await this.ledger.post({
      idempotencyKey: `ship-capture:${ref}`,
      description: `خصم شحن مؤكَّد للطلب ${ref}`,
      reference: ref,
      postings: [
        { accountCode: merchantHold(merchantId), side: "DEBIT", amountMinor: amount },
        { accountCode: PlatformAccounts.PAYABLE_CARRIER, side: "CREDIT", amountMinor: amount },
      ],
    });
  }

  /** عند الإلغاء: إرجاع الحجز إلى محفظة التاجر. */
  private async releaseHold(merchantId: string, amount: bigint, ref: string): Promise<void> {
    await this.ledger.post({
      idempotencyKey: `ship-release:${ref}`,
      description: `تحرير حجز شحن للطلب ${ref}`,
      reference: ref,
      postings: [
        { accountCode: merchantHold(merchantId), side: "DEBIT", amountMinor: amount },
        { accountCode: merchantWallet(merchantId), side: "CREDIT", amountMinor: amount },
      ],
    });
  }

  /** تسوية طلب COD عند التسليم. */
  private async settleCod(order: Order, merchantId: string): Promise<void> {
    const subtotal = order.subtotalMinor;
    const shipping = order.shippingMinor;
    const commission = this.pricing.commission(subtotal);

    let postings: PostingInput[];
    if (!order.merchantPaysShipping) {
      // العميل يدفع الشحن: النقد المُحصَّل = الإجمالي. الشحن لشركة الشحن.
      const total = subtotal + shipping;
      postings = nonZero([
        { accountCode: PlatformAccounts.COD_CLEARING, side: "DEBIT", amountMinor: total },
        { accountCode: merchantSettlement(merchantId), side: "CREDIT", amountMinor: subtotal - commission },
        { accountCode: PlatformAccounts.REVENUE_COMMISSION, side: "CREDIT", amountMinor: commission },
        { accountCode: PlatformAccounts.PAYABLE_CARRIER, side: "CREDIT", amountMinor: shipping },
      ]);
    } else {
      // التاجر يتحمّل الشحن: يُصافى من تحصيل COD (قيمة الطلب − الشحن − عمولة التحصيل).
      const collection = this.pricing.collection(subtotal);
      const net = subtotal - shipping - collection;
      if (net < 0n) {
        throw new BadRequestException(
          "قيمة الطلب لا تغطّي الشحن وعمولة التحصيل — راجع تسعير الشحن",
        );
      }
      postings = nonZero([
        { accountCode: PlatformAccounts.COD_CLEARING, side: "DEBIT", amountMinor: subtotal },
        { accountCode: merchantSettlement(merchantId), side: "CREDIT", amountMinor: net },
        { accountCode: PlatformAccounts.PAYABLE_CARRIER, side: "CREDIT", amountMinor: shipping },
        { accountCode: PlatformAccounts.REVENUE_COLLECTION, side: "CREDIT", amountMinor: collection },
      ]);
    }

    await this.ledger.post({
      idempotencyKey: `order-cod:${order.id}`,
      description: `تسوية تحصيل COD للطلب ${order.id}`,
      reference: order.id,
      postings,
    });
  }
}
