import { Injectable, NotFoundException } from "@nestjs/common";
import type { Order } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { LedgerService, type PostingInput } from "../ledger/ledger.service.js";
import { merchantSettlement, PlatformAccounts } from "../ledger/accounts.js";
import { PricingService } from "./pricing.js";
import type { PlaceOrderDto } from "./dto.js";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * إنشاء طلب. للطلبات الإلكترونية (ONLINE) يُسجَّل التحصيل والتسوية فوراً
   * (الدفع مُقدَّم). لطلبات COD لا قيد مالي عند الإنشاء — النقد يُحصَّل عند التسليم.
   */
  async place(dto: PlaceOrderDto): Promise<Order> {
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException("العميل غير موجود");

    const merchantId = store.merchantId;
    await this.accounts.ensurePlatform();
    await this.accounts.ensureMerchant(merchantId);

    const subtotal = dto.items.reduce(
      (sum, it) => sum + BigInt(it.unitPriceMinor) * BigInt(it.quantity),
      0n,
    );
    const merchantPaysShipping = dto.merchantPaysShipping ?? store.merchantPaysShipping;
    const customerPaysShipping = !merchantPaysShipping;
    const shipping = BigInt(dto.shippingMinor);
    const total = subtotal + (customerPaysShipping ? shipping : 0n);

    const order = await this.prisma.order.create({
      data: {
        storeId: dto.storeId,
        customerId: dto.customerId,
        paymentMethod: dto.paymentMethod,
        subtotalMinor: subtotal,
        shippingMinor: shipping,
        totalMinor: total,
        merchantPaysShipping,
        items: {
          create: dto.items.map((it) => ({
            productId: it.productId ?? "00000000-0000-0000-0000-000000000000",
            nameSnapshot: it.name,
            unitPriceMinor: BigInt(it.unitPriceMinor),
            quantity: it.quantity,
          })),
        },
      },
    });

    if (dto.paymentMethod === "ONLINE") {
      await this.settleOnlinePayment(order, merchantId);
    }
    return order;
  }

  /**
   * تسوية الدفع الإلكتروني عند الإنشاء (نموذج PayFac):
   *  - النقد الوارد يُقيَّد كاملاً، وتُقتطع رسوم البوابة (MDR) والعمولة قبل
   *    تقييد صافي التاجر، وحصة العميل من الشحن (إن دفعها) تذهب لشركة الشحن.
   */
  private async settleOnlinePayment(order: Order, merchantId: string): Promise<void> {
    const subtotal = order.subtotalMinor;
    const customerPaysShipping = !order.merchantPaysShipping;
    const carrierShipping = customerPaysShipping ? order.shippingMinor : 0n;
    const total = order.totalMinor;
    const mdr = this.pricing.mdr(total);
    const commission = this.pricing.commission(subtotal);
    const settlementNet = subtotal - commission;

    const postings: PostingInput[] = nonZero([
      { accountCode: PlatformAccounts.CASH, side: "DEBIT", amountMinor: total },
      { accountCode: PlatformAccounts.EXPENSE_MDR, side: "DEBIT", amountMinor: mdr },
      { accountCode: merchantSettlement(merchantId), side: "CREDIT", amountMinor: settlementNet },
      { accountCode: PlatformAccounts.REVENUE_COMMISSION, side: "CREDIT", amountMinor: commission },
      { accountCode: PlatformAccounts.PAYABLE_CARRIER, side: "CREDIT", amountMinor: carrierShipping },
      { accountCode: PlatformAccounts.PAYABLE_ACQUIRER, side: "CREDIT", amountMinor: mdr },
    ]);

    await this.ledger.post({
      idempotencyKey: `order-online:${order.id}`,
      description: `تسوية دفع إلكتروني للطلب ${order.id}`,
      reference: order.id,
      postings,
    });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("الطلب غير موجود");
    return order;
  }
}

/** يستبعد السطور ذات المبلغ صفر (محرّك الدفتر يتطلّب مبالغ موجبة فقط). */
export function nonZero(postings: PostingInput[]): PostingInput[] {
  return postings.filter((p) => p.amountMinor > 0n);
}
