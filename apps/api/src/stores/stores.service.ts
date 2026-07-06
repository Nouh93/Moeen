import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  /** توليد slug عربي/لاتيني آمن للرابط */
  static slugify(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "store"
    );
  }

  async create(
    ownerId: string,
    data: {
      name: string;
      slug?: string;
      description?: string;
      whatsapp?: string;
      currency?: string;
      governorateId?: number;
      city?: string;
      shippingFee?: number;
    },
  ) {
    const slug = StoresService.slugify(data.slug ?? data.name);
    try {
      return await this.prisma.store.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          whatsapp: data.whatsapp,
          currency: (data.currency as any) ?? "YER_SANAA",
          governorateId: data.governorateId,
          city: data.city,
          shippingFee: data.shippingFee ?? 0,
          ownerId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "رابط المتجر محجوز — جرّب اسماً أو رابطاً مختلفاً",
        );
      }
      throw e;
    }
  }

  mine(ownerId: string) {
    return this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
    });
  }

  /** يتأكد أن المتجر ملك هذا التاجر — أساس عزل المستأجرين في كل نقاط النهاية */
  async ownedByOrThrow(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    if (store.ownerId !== ownerId) {
      throw new ForbiddenException("ليست لديك صلاحية على هذا المتجر");
    }
    return store;
  }

  async update(
    storeId: string,
    ownerId: string,
    data: Partial<{
      name: string;
      description: string;
      whatsapp: string;
      shippingFee: number;
      codConfirmation: boolean;
    }>,
  ) {
    await this.ownedByOrThrow(storeId, ownerId);
    return this.prisma.store.update({ where: { id: storeId }, data });
  }

  /** واجهة المتجر العامة: بيانات المتجر + منتجاته + شارات الثقة (القسم 25.1) */
  async publicBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        governorate: true,
        categories: { orderBy: { sortOrder: "asc" } },
        shippingRates: { include: { governorate: true } },
        products: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          include: { variants: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!store || store.status !== "ACTIVE") {
      // المتجر المعلَّق يُخفى من الزوار — القسم 24.5 بالملحق
      throw new NotFoundException("المتجر غير موجود أو موقوف حالياً");
    }

    // شارات الثقة والشفافية (القسمان 25.1 و25.3)
    const [rating, delivered, total] = await Promise.all([
      this.prisma.review.aggregate({
        where: { storeId: store.id, status: "VISIBLE" },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.order.count({ where: { storeId: store.id, status: "DELIVERED" } }),
      this.prisma.order.count({
        where: { storeId: store.id, status: { in: ["DELIVERED", "CANCELLED", "RETURNED"] } },
      }),
    ]);
    const completionRate = total > 0 ? delivered / total : 1;
    const ageDays = (Date.now() - store.createdAt.getTime()) / 86_400_000;
    // شارة «متجر موثوق» 🏅 — معايير القسم 25.1.1
    const trusted =
      store.kycLevel >= 2 &&
      ageDays >= 90 &&
      (rating._avg.rating ?? 0) >= 4 &&
      rating._count >= 5 &&
      completionRate >= 0.85;

    const { ownerId, ...pub } = store;
    return {
      ...pub,
      badges: {
        verified: store.kycLevel >= 1, // «هوية موثّقة» ✓ (25.1.3)
        trusted,
      },
      rating: {
        average: rating._avg.rating ?? 0,
        count: rating._count,
      },
      deliveredOrders: delivered, // «أكمل X طلباً» علناً (25.3)
    };
  }

  // ---- أسعار الشحن لكل محافظة (القسم 8.2) ----

  async listShippingRates(storeId: string, ownerId: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    return this.prisma.shippingRate.findMany({
      where: { storeId },
      include: { governorate: true },
      orderBy: { governorateId: "asc" },
    });
  }

  async upsertShippingRate(
    storeId: string,
    ownerId: string,
    data: { governorateId: number; fee: number; etaText?: string },
  ) {
    await this.ownedByOrThrow(storeId, ownerId);
    return this.prisma.shippingRate.upsert({
      where: {
        storeId_governorateId: { storeId, governorateId: data.governorateId },
      },
      create: { storeId, ...data },
      update: { fee: data.fee, etaText: data.etaText },
    });
  }

  async deleteShippingRate(storeId: string, ownerId: string, id: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id, storeId },
    });
    if (!rate) throw new NotFoundException("سعر الشحن غير موجود");
    return this.prisma.shippingRate.delete({ where: { id } });
  }

  // ---- إحصائيات لوحة التاجر (القسم 11.1): أرقام كبيرة واضحة ----

  async stats(storeId: string, ownerId: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // المبيعات = الطلبات غير الملغاة/المرتجعة
    const salesWhere = (from: Date) => ({
      storeId,
      createdAt: { gte: from },
      status: { notIn: ["CANCELLED" as const, "RETURNED" as const] },
    });

    const [today, week, month, byStatus, topItems] = await Promise.all([
      this.prisma.order.aggregate({
        where: salesWhere(startOfDay),
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: salesWhere(startOfWeek),
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: salesWhere(startOfMonth),
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ["status"],
        where: { storeId },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            storeId,
            status: { notIn: ["CANCELLED", "RETURNED"] },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    const fmt = (r: { _count: number; _sum: { total: any } }) => ({
      orders: r._count,
      revenue: r._sum.total ?? 0,
    });
    return {
      today: fmt(today),
      week: fmt(week),
      month: fmt(month),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      topProducts: topItems.map((t) => ({
        name: t.name,
        sold: t._sum.quantity ?? 0,
      })),
    };
  }
}
