import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
  normalizeYemeniPhone,
} from "@moeen/shared";
import { randomInt } from "crypto";
import { CartsService } from "../carts/carts.module";
import { CouponsService } from "../coupons/coupons.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TEMPLATES } from "../notifications/templates";
import { bestOfferPercent } from "../offers/offer-logic";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const LOW_STOCK_THRESHOLD = 3;

export interface CheckoutItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CheckoutData {
  customerName: string;
  customerPhone: string;
  governorateId: number;
  districtId?: number;
  districtText?: string;
  neighborhood: string;
  addressDetails: string;
  courierNote?: string;
  couponCode?: string;
  items: CheckoutItem[];
  idempotencyKey?: string;
}

/** كود تتبع قصير سهل الإملاء عبر الهاتف: MN-XXXXXX */
function trackingCode(): string {
  return `MN-${randomInt(100000, 999999)}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
    private coupons: CouponsService,
    private notifications: NotificationsService,
    private carts: CartsService,
  ) {}

  /** حساب رسوم الشحن: سعر المحافظة إن وُجد، وإلا الافتراضي، والمجاني فوق الحد (القسم 8.2) */
  private async computeShipping(
    store: { id: string; shippingFee: Prisma.Decimal; freeShippingAbove: Prisma.Decimal | null },
    governorateId: number,
    subtotal: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    if (store.freeShippingAbove && subtotal.gte(store.freeShippingAbove)) {
      return new Prisma.Decimal(0);
    }
    const rate = await this.prisma.shippingRate.findUnique({
      where: { storeId_governorateId: { storeId: store.id, governorateId } },
    });
    return rate ? rate.fee : store.shippingFee;
  }

  /** إنشاء طلب COD من واجهة المتجر — عام، بدون تسجيل (القسم 6.3) */
  async checkout(slug: string, data: CheckoutData) {
    const phone = normalizeYemeniPhone(data.customerPhone);
    if (!phone) {
      throw new BadRequestException(
        "رقم الجوال غير صحيح — أدخل رقماً يمنياً يبدأ بـ 7",
      );
    }
    if (!data.items?.length) {
      throw new BadRequestException("السلة فارغة");
    }

    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store || store.status !== "ACTIVE") {
      throw new NotFoundException("المتجر غير موجود أو موقوف حالياً");
    }

    // وضع الإجازة (القسم 7.5): المتجر ظاهر لكن الطلبات موقوفة برسالة التاجر
    if (store.vacationMode) {
      throw new BadRequestException(
        store.vacationMessage?.trim() ||
          "المتجر في إجازة قصيرة — نستقبل طلبك قريباً بإذن الله",
      );
    }

    // العميل المحظور (القسم 7.6) — رسالة مهذبة لا تكشف الحظر صراحةً
    const isBlocked = await this.prisma.blockedCustomer.findUnique({
      where: { storeId_phone: { storeId: store.id, phone } },
    });
    if (isBlocked) {
      throw new BadRequestException(
        "تعذّر إتمام الطلب حالياً — تواصل مع المتجر مباشرة لإتمام طلبك",
      );
    }

    // idempotency: إعادة إرسال نفس الطلب (بعد انقطاع الإنترنت) لا تنشئ طلباً جديداً
    // — القسم 22.1.2 بالملحق
    if (data.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: {
          storeId_idempotencyKey: {
            storeId: store.id,
            idempotencyKey: data.idempotencyKey,
          },
        },
        include: { items: true },
      });
      if (existing) return { order: existing, duplicate: true };
    }

    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          storeId: store.id,
          status: "ACTIVE",
        },
        include: { variants: true },
      }),
      // العروض التلقائية السارية — تُطبَّق هنا حصراً (السعر النهائي من الخادم دائماً)
      this.prisma.offer.findMany({
        where: {
          storeId: store.id,
          active: true,
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
      }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = new Prisma.Decimal(0);
    const itemsData = data.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException("أحد المنتجات لم يعد متوفراً — حدّث سلتك");
      }
      const qty = Math.max(1, Math.floor(item.quantity));
      // حدود الكمية لكل طلب (القسم 5.5)
      if (qty < product.minQty) {
        throw new BadRequestException(
          `أقل كمية للطلب من "${product.name}" هي ${product.minQty}`,
        );
      }
      if (product.maxQty && qty > product.maxQty) {
        throw new BadRequestException(
          `أقصى كمية للطلب من "${product.name}" هي ${product.maxQty}`,
        );
      }
      // خيار المنتج (مقاس/لون) — سعر ومخزون مستقلان (القسم 5.1)
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : undefined;
      if (item.variantId && !variant) {
        throw new BadRequestException(`خيار "${product.name}" لم يعد متوفراً — حدّث سلتك`);
      }
      if (variant) {
        if (variant.stock < qty) {
          throw new BadRequestException(
            `الكمية المطلوبة من "${product.name} — ${variant.name}" غير متوفرة — المتبقي ${variant.stock}`,
          );
        }
      } else if (product.trackStock && product.stock < qty) {
        throw new BadRequestException(
          `الكمية المطلوبة من "${product.name}" غير متوفرة — المتبقي ${product.stock}`,
        );
      }
      let unitPrice = variant?.price ?? product.price;
      const offerPercent = bestOfferPercent(offers, product.categoryId);
      if (offerPercent > 0) {
        unitPrice = unitPrice.mul(100 - offerPercent).div(100).toDecimalPlaces(2);
      }
      subtotal = subtotal.add(unitPrice.mul(qty));
      return {
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        price: unitPrice,
        quantity: qty,
      };
    });

    // الحد الأدنى لقيمة الطلب (القسم 7.5) — قبل الشحن وبعد العروض
    if (store.minOrderTotal && subtotal.lt(store.minOrderTotal)) {
      throw new BadRequestException(
        `الحد الأدنى للطلب من هذا المتجر ${Number(store.minOrderTotal).toLocaleString("ar-u-nu-latn")} — أضف منتجات أخرى لإتمام طلبك`,
      );
    }

    const shippingFee = await this.computeShipping(
      store,
      data.governorateId,
      subtotal,
    );

    // الكوبون (القسم 9.1) — التحقق النهائي داخل الإنشاء
    let couponId: string | null = null;
    let discount = new Prisma.Decimal(0);
    if (data.couponCode) {
      const result = await this.coupons.validate(
        store.id,
        data.couponCode,
        subtotal,
      );
      couponId = result.coupon.id;
      discount = result.discount;
    }

    const total = subtotal.sub(discount).add(shippingFee);
    // تأكيد COD هاتفياً مفعّل → الطلب يبدأ "جديد — قيد المراجعة" (القسم 7.1)
    const initialStatus = "NEW" as const;

    const order = await this.prisma.$transaction(async (tx) => {
      // خصم المخزون داخل نفس المعاملة — القسم 5.3
      for (const item of itemsData) {
        const p = byId.get(item.productId)!;
        if (item.variantId) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new BadRequestException(`نفدت كمية "${item.name}" للتو — حدّث سلتك`);
          }
        } else if (p.trackStock) {
          const updated = await tx.product.updateMany({
            where: { id: p.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new BadRequestException(
              `نفدت كمية "${p.name}" للتو — حدّث سلتك`,
            );
          }
        }
      }
      if (couponId) await this.coupons.consume(tx, couponId);
      return tx.order.create({
        data: {
          code: trackingCode(),
          storeId: store.id,
          idempotencyKey: data.idempotencyKey,
          customerName: data.customerName,
          customerPhone: phone,
          governorateId: data.governorateId,
          districtId: data.districtId,
          districtText: data.districtText,
          neighborhood: data.neighborhood,
          addressDetails: data.addressDetails,
          courierNote: data.courierNote,
          paymentMethod: "COD",
          status: initialStatus,
          subtotal,
          couponCode: data.couponCode?.trim().toUpperCase(),
          discount,
          shippingFee,
          total,
          currency: store.currency,
          items: { create: itemsData },
          events: {
            create: { status: initialStatus, note: "وصل الطلب بنجاح" },
          },
        },
        include: { items: true },
      });
    });

    // إشعارات واتساب عبر الطابور — لا تعطّل استجابة الطلب لو تعثّرت
    const trackUrl = `${WEB_URL}/track/${order.code}`;
    await Promise.allSettled([
      this.notifications.enqueue({
        storeId: store.id,
        orderId: order.id,
        recipient: phone,
        template: "ORDER_CONFIRMED_CUSTOMER",
        body: TEMPLATES.ORDER_CONFIRMED_CUSTOMER(order as any, store.name, trackUrl),
      }),
      ...(store.whatsapp
        ? [
            this.notifications.enqueue({
              storeId: store.id,
              orderId: order.id,
              recipient: store.whatsapp,
              template: "NEW_ORDER_MERCHANT",
              body: TEMPLATES.NEW_ORDER_MERCHANT(order as any, `${WEB_URL}/dashboard`),
            }),
          ]
        : []),
      this.notifyLowStock(store, itemsData.map((i) => i.productId)),
      this.carts.clear(store.id, phone),
    ]);

    return { order, duplicate: false };
  }

  /** تنبيه نقص المخزون للتاجر بعد البيع (القسم 5.3) */
  private async notifyLowStock(
    store: { id: string; whatsapp: string | null },
    productIds: string[],
  ) {
    if (!store.whatsapp) return;
    const lowProducts = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        trackStock: true,
        stock: { lte: LOW_STOCK_THRESHOLD },
      },
    });
    for (const p of lowProducts) {
      await this.notifications.enqueue({
        storeId: store.id,
        recipient: store.whatsapp,
        template: "LOW_STOCK_MERCHANT",
        body: TEMPLATES.LOW_STOCK_MERCHANT(p.name, p.stock, `${WEB_URL}/dashboard`),
      });
    }
  }

  /** تتبع عام برمز الطلب — يعمل بدون تسجيل دخول (القسم 6.3) */
  async track(code: string) {
    const order = await this.prisma.order.findUnique({
      where: { code },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        store: { select: { name: true, slug: true, whatsapp: true } },
        governorate: true,
        district: true,
      },
    });
    if (!order) throw new NotFoundException("لم نجد طلباً بهذا الرمز");
    const [review, dispute] = await Promise.all([
      this.prisma.review.findUnique({ where: { orderId: order.id }, select: { id: true } }),
      this.prisma.dispute.findUnique({ where: { orderId: order.id }, select: { status: true } }),
    ]);
    // لا نكشف رقم جوال العميل كاملاً في صفحة عامة
    return {
      ...order,
      customerPhone: order.customerPhone.slice(0, -4) + "****",
      hasReview: !!review,
      dispute: dispute?.status ?? null,
    };
  }

  /** طلبات المشتري عبر كل المتاجر — صفحة «طلباتي» (القسم 6.4) */
  forCustomer(phone: string) {
    return this.prisma.order.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: true,
        store: { select: { name: true, slug: true, currency: true, logoUrl: true } },
      },
    });
  }

  // ---- نقاط نهاية التاجر ----

  async list(
    storeId: string,
    ownerId: string,
    opts: { status?: string; q?: string; page?: number } = {},
  ) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const PAGE_SIZE = 20;
    const page = Math.max(1, opts.page ?? 1);
    const where = {
      storeId,
      ...(opts.status ? { status: opts.status as any } : {}),
      // بحث برمز الطلب أو اسم العميل أو جواله (القسم 12.1)
      ...(opts.q
        ? {
            OR: [
              { code: { contains: opts.q.toUpperCase() } },
              { customerName: { contains: opts.q } },
              { customerPhone: { contains: opts.q.replace(/\D/g, "") } },
            ],
          }
        : {}),
    };
    const [orders, count] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, governorate: true, district: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, count, page, pages: Math.ceil(count / PAGE_SIZE) };
  }

  /** طلب واحد بالتفصيل — لصفحة البوليصة والطباعة (القسم 8.3) */
  async getOne(storeId: string, ownerId: string, orderId: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        items: true,
        governorate: true,
        district: true,
        events: { orderBy: { createdAt: "asc" } },
        store: { select: { name: true, whatsapp: true, city: true } },
      },
    });
    if (!order) throw new NotFoundException("الطلب غير موجود");
    return order;
  }

  async updateStatus(
    storeId: string,
    ownerId: string,
    orderId: string,
    status: OrderStatus,
    note?: string,
  ) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
    });
    if (!order) throw new NotFoundException("الطلب غير موجود");

    const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `لا يمكن نقل الطلب من حالته الحالية إلى هذه الحالة`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // إلغاء أو إرجاع → إعادة الكمية للمخزون
      if (status === "CANCELLED" || status === "RETURNED") {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          include: { product: true },
        });
        for (const item of items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.product?.trackStock) {
            await tx.product.update({
              where: { id: item.product.id },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status, events: { create: { status, note } } },
        include: {
          items: true,
          events: { orderBy: { createdAt: "asc" } },
          store: { select: { name: true } },
        },
      });
      return updated;
    }).then(async (updated) => {
      // إشعار واتساب للعميل بكل تغيير حالة (القسم 7.1)
      await this.notifications.enqueue({
        storeId,
        orderId: updated.id,
        recipient: updated.customerPhone,
        template: "ORDER_STATUS_CUSTOMER",
        body: TEMPLATES.ORDER_STATUS_CUSTOMER(
          updated as any,
          updated.store.name,
          `${WEB_URL}/track/${updated.code}`,
        ),
      });
      return updated;
    });
  }

  /**
   * تحديث حالة مجموعة طلبات دفعة واحدة (القسم 7.7).
   * كل طلب يمر بنفس تحققات التحديث المنفرد؛ ما لا تسمح حالته بالانتقال يُتخطى ويُبلَّغ عنه.
   */
  async bulkUpdateStatus(
    storeId: string,
    ownerId: string,
    orderIds: string[],
    status: OrderStatus,
  ) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const results = { updated: 0, skipped: [] as { id: string; reason: string }[] };
    for (const orderId of orderIds.slice(0, 100)) {
      try {
        await this.updateStatus(storeId, ownerId, orderId, status);
        results.updated += 1;
      } catch (e: any) {
        results.skipped.push({ id: orderId, reason: e.message ?? "خطأ" });
      }
    }
    return results;
  }
}
