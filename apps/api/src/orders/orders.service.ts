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
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";

export interface CheckoutItem {
  productId: string;
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
  ) {}

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

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: data.items.map((i) => i.productId) },
        storeId: store.id,
        status: "ACTIVE",
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = new Prisma.Decimal(0);
    const itemsData = data.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException("أحد المنتجات لم يعد متوفراً — حدّث سلتك");
      }
      const qty = Math.max(1, Math.floor(item.quantity));
      if (product.trackStock && product.stock < qty) {
        throw new BadRequestException(
          `الكمية المطلوبة من "${product.name}" غير متوفرة — المتبقي ${product.stock}`,
        );
      }
      subtotal = subtotal.add(product.price.mul(qty));
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
      };
    });

    const shippingFee = store.shippingFee;
    const total = subtotal.add(shippingFee);
    // تأكيد COD هاتفياً مفعّل → الطلب يبدأ "جديد — قيد المراجعة" (القسم 7.1)
    const initialStatus = "NEW" as const;

    const order = await this.prisma.$transaction(async (tx) => {
      // خصم المخزون داخل نفس المعاملة — القسم 5.3
      for (const item of itemsData) {
        const p = byId.get(item.productId)!;
        if (p.trackStock) {
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

    // TODO المرحلة 2: إشعار واتساب فوري للعميل والتاجر (القسم 26.2.1 بالملحق)
    return { order, duplicate: false };
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
    // لا نكشف رقم جوال العميل كاملاً في صفحة عامة
    return { ...order, customerPhone: order.customerPhone.slice(0, -4) + "****" };
  }

  // ---- نقاط نهاية التاجر ----

  async list(storeId: string, ownerId: string, status?: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    return this.prisma.order.findMany({
      where: { storeId, ...(status ? { status: status as any } : {}) },
      include: { items: true, governorate: true, district: true },
      orderBy: { createdAt: "desc" },
    });
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
          if (item.product?.trackStock) {
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
        include: { items: true, events: { orderBy: { createdAt: "asc" } } },
      });
      // TODO المرحلة 2: إشعار واتساب للعميل بكل تغيير حالة (القسم 7.1)
      return updated;
    });
  }
}
