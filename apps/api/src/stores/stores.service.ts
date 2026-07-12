import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { bestOfferPercent } from "../offers/offer-logic";
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
      logoUrl: string;
      freeShippingAbove: number | null;
      themeColor: string | null;
      coverUrl: string | null;
      banners: { imageUrl: string; link?: string }[];
      aboutText: string | null;
      returnPolicy: string | null;
      socialLinks: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
        x?: string;
      };
      minOrderTotal: number | null;
      vacationMode: boolean;
      vacationMessage: string | null;
      thankYouNote: string | null;
    }>,
  ) {
    await this.ownedByOrThrow(storeId, ownerId);
    const { banners, socialLinks, ...rest } = data;
    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...rest,
        ...(banners !== undefined
          ? { banners: JSON.parse(JSON.stringify(banners)) }
          : {}),
        ...(socialLinks !== undefined
          ? { socialLinks: JSON.parse(JSON.stringify(socialLinks)) }
          : {}),
      },
    });
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
          // المنتجات المميزة تتصدّر الواجهة (القسم 5.4)
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          include: { variants: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!store || store.status !== "ACTIVE") {
      // المتجر المعلَّق يُخفى من الزوار — القسم 24.5 بالملحق
      throw new NotFoundException("المتجر غير موجود أو موقوف حالياً");
    }

    // شارات الثقة والشفافية (القسمان 25.1 و25.3)
    const [rating, delivered, total, offers] = await Promise.all([
      this.prisma.review.aggregate({
        where: { storeId: store.id, status: "VISIBLE" },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.order.count({ where: { storeId: store.id, status: "DELIVERED" } }),
      this.prisma.order.count({
        where: { storeId: store.id, status: { in: ["DELIVERED", "CANCELLED", "RETURNED"] } },
      }),
      this.prisma.offer.findMany({
        where: {
          storeId: store.id,
          active: true,
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
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

    // العروض التلقائية (القسم 9.3): سعر بعد الخصم لكل منتج مشمول.
    // سعر التكلفة سر تجاري — لا يخرج للواجهة العامة أبداً
    const productsWithOffers = store.products.map(({ costPrice, ...p }) => {
      const percent = bestOfferPercent(offers, p.categoryId);
      if (!percent) return p;
      const title = offers
        .filter((o) => (!o.categoryId || o.categoryId === p.categoryId) && o.percent === percent)
        .map((o) => o.title)[0];
      return {
        ...p,
        offerPercent: percent,
        offerTitle: title,
        offerPrice: Number(p.price) * (1 - percent / 100),
      };
    });

    const { ownerId, ...pub } = store;
    return {
      ...pub,
      products: productsWithOffers,
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

  // ---- تقارير التاجر (القسم 11.2): مبيعات 30 يوماً + أفضل المنتجات + المحافظات ----

  async reports(storeId: string, ownerId: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const sold = { status: { notIn: ["CANCELLED" as const, "RETURNED" as const] } };

    const [orders30, items90, byGov, governorates] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId, createdAt: { gte: since30 }, ...sold },
        select: { createdAt: true, total: true },
      }),
      this.prisma.orderItem.findMany({
        where: { order: { storeId, createdAt: { gte: since90 }, ...sold } },
        select: { name: true, quantity: true, price: true },
      }),
      this.prisma.order.groupBy({
        by: ["governorateId"],
        where: { storeId, createdAt: { gte: since90 }, ...sold },
        _count: true,
      }),
      this.prisma.governorate.findMany({ select: { id: true, nameAr: true } }),
    ]);

    // سلسلة يومية كاملة (الأيام بلا مبيعات = صفر) بتوقيت الخادم
    const days: { date: string; orders: number; revenue: number }[] = [];
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders30) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number(o.total);
      byDay.set(d, cur);
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      days.push({ date: d, ...(byDay.get(d) ?? { orders: 0, revenue: 0 }) });
    }

    const byProduct = new Map<string, { sold: number; revenue: number }>();
    for (const it of items90) {
      const cur = byProduct.get(it.name) ?? { sold: 0, revenue: 0 };
      cur.sold += it.quantity;
      cur.revenue += Number(it.price) * it.quantity;
      byProduct.set(it.name, cur);
    }
    const topProducts = [...byProduct.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7);

    const govName = new Map(governorates.map((g) => [g.id, g.nameAr]));
    const byGovernorate = byGov
      .map((g) => ({
        name: g.governorateId ? (govName.get(g.governorateId) ?? "غير محدد") : "غير محدد",
        orders: g._count,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);

    return { days, topProducts, byGovernorate };
  }

  // ---- حظر العملاء (القسم 7.6): درع التاجر ضد طلبات COD الوهمية ----

  async listBlocked(storeId: string, ownerId: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    return this.prisma.blockedCustomer.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
  }

  async blockCustomer(storeId: string, ownerId: string, phone: string, reason?: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    return this.prisma.blockedCustomer.upsert({
      where: { storeId_phone: { storeId, phone } },
      create: { storeId, phone, reason },
      update: { reason },
    });
  }

  async unblockCustomer(storeId: string, ownerId: string, phone: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    await this.prisma.blockedCustomer.deleteMany({ where: { storeId, phone } });
    return { ok: true };
  }

  /** عملاء المتجر (القسم 11.3): تجميع من الطلبات — عدد الطلبات والإنفاق وآخر طلب */
  async customers(storeId: string, ownerId: string) {
    await this.ownedByOrThrow(storeId, ownerId);
    const blocked = new Set(
      (
        await this.prisma.blockedCustomer.findMany({
          where: { storeId },
          select: { phone: true },
        })
      ).map((b) => b.phone),
    );
    const orders = await this.prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      select: {
        customerName: true,
        customerPhone: true,
        total: true,
        status: true,
        createdAt: true,
      },
      take: 2000,
    });
    const map = new Map<
      string,
      { name: string; phone: string; orders: number; delivered: number; spent: number; lastOrderAt: Date }
    >();
    for (const o of orders) {
      const cur = map.get(o.customerPhone);
      const delivered = o.status === "DELIVERED" ? 1 : 0;
      const spent = ["CANCELLED", "RETURNED"].includes(o.status) ? 0 : Number(o.total);
      if (cur) {
        cur.orders += 1;
        cur.delivered += delivered;
        cur.spent += spent;
      } else {
        map.set(o.customerPhone, {
          name: o.customerName, // الأحدث لأن الترتيب تنازلي
          phone: o.customerPhone,
          orders: 1,
          delivered,
          spent,
          lastOrderAt: o.createdAt,
        });
      }
    }
    return [...map.values()]
      .map((c) => ({ ...c, blocked: blocked.has(c.phone) }))
      .sort((a, b) => b.spent - a.spent);
  }
}
