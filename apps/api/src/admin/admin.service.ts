import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

/** خدمات لوحة إدارة المنصة (القسم 14) */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
    private notifications: NotificationsService,
  ) {}

  // ---- 14.4 نظرة عامة ----
  async overview() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesWhere = (from: Date) => ({
      createdAt: { gte: from },
      status: { notIn: ["CANCELLED" as const, "RETURNED" as const] },
    });
    const [stores, activeStores, suspended, ordersToday, gmvMonth, pendingKyc, exceptions, openDisputes, paidInvoicesMonth] =
      await Promise.all([
        this.prisma.store.count(),
        this.prisma.store.count({ where: { status: "ACTIVE" } }),
        this.prisma.store.count({ where: { status: "SUSPENDED" } }),
        this.prisma.order.count({ where: salesWhere(startOfDay) }),
        this.prisma.order.aggregate({ where: salesWhere(startOfMonth), _sum: { total: true }, _count: true }),
        this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
        this.prisma.paymentEvent.count({ where: { status: "EXCEPTION" } }),
        this.prisma.dispute.count({ where: { status: "OPEN" } }),
        this.prisma.invoice.aggregate({
          where: { status: "PAID", paidAt: { gte: startOfMonth } },
          _sum: { amount: true },
          _count: true,
        }),
      ]);
    return {
      stores,
      activeStores,
      suspended,
      ordersToday,
      gmvMonth: gmvMonth._sum.total ?? 0,
      ordersMonth: gmvMonth._count,
      pendingKyc,
      exceptions,
      openDisputes,
      revenueMonth: paidInvoicesMonth._sum.amount ?? 0,
      paidInvoicesMonth: paidInvoicesMonth._count,
    };
  }

  // ---- 14.1 إدارة التجار ----
  async stores(q?: string, page = 1) {
    const PAGE = 20;
    const where: Prisma.StoreWhereInput = q
      ? {
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
            { owner: { phone: { contains: q.replace(/\D/g, "") || q } } },
          ],
        }
      : {};
    const [items, count] = await Promise.all([
      this.prisma.store.findMany({
        where,
        include: {
          owner: { select: { phone: true, name: true } },
          _count: { select: { orders: true, products: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
      this.prisma.store.count({ where }),
    ]);
    return { items, count, pages: Math.ceil(count / PAGE) };
  }

  /** تعليق/إعادة تفعيل متجر مع سبب مسجّل (القسم 14.1) */
  async setStoreStatus(storeId: string, status: "ACTIVE" | "SUSPENDED" | "CLOSED", reason: string | undefined, adminId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true },
    });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { status, suspensionReason: status === "ACTIVE" ? null : reason },
    });
    await this.notifications.enqueue({
      storeId,
      recipient: store.owner.phone,
      template: "STORE_STATUS_ADMIN",
      body:
        status === "ACTIVE"
          ? `مرحباً ${store.owner.name ?? store.name} 👋\nأُعيد تفعيل متجرك «${store.name}» وأصبح ظاهراً للزوار من جديد. نسعد بوجودك في مُعين!`
          : `مرحباً ${store.owner.name ?? store.name}،\nعُلّق متجرك «${store.name}» مؤقتاً${reason ? ` للسبب التالي: ${reason}` : ""}.\nلوحة تحكمك تعمل وبياناتك محفوظة — تواصل مع الدعم لمعالجة الأمر.`,
    });
    return updated;
  }

  // ---- 14.1 مراجعة KYC (القسم 4.3) ----
  kycQueue(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
    return this.prisma.kycSubmission.findMany({
      where: { status },
      include: {
        store: {
          select: { id: true, name: true, slug: true, kycLevel: true, owner: { select: { phone: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  }

  async reviewKyc(id: string, approve: boolean, adminNote: string | undefined, adminId: string) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { store: { include: { owner: true } } },
    });
    if (!submission) throw new NotFoundException("الطلب غير موجود");
    if (submission.status !== "PENDING") {
      throw new BadRequestException("هذا الطلب رُوجع سابقاً");
    }
    if (!approve && !adminNote) {
      throw new BadRequestException("اذكر سبب الرفض المحدد — يصل التاجر (القسم 4.3)");
    }
    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          adminNote,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      ...(approve
        ? [
            this.prisma.store.update({
              where: { id: submission.storeId },
              data: { kycLevel: Math.max(submission.store.kycLevel, submission.level) },
            }),
          ]
        : []),
    ]);
    await this.notifications.enqueue({
      storeId: submission.storeId,
      recipient: submission.store.owner.phone,
      template: approve ? "KYC_APPROVED" : "KYC_REJECTED",
      body: approve
        ? `مبروك ${submission.store.owner.name ?? ""} 🎉\nاكتمل توثيق متجرك «${submission.store.name}» (مستوى ${submission.level})${submission.level >= 1 ? " — ستظهر شارة «هوية موثّقة ✓» في متجرك" : ""}.\n${WEB_URL}/dashboard`
        : `مرحباً ${submission.store.owner.name ?? ""}،\nلم نستطع اعتماد توثيق متجرك هذه المرة.\nالسبب: ${adminNote}\nعدّل البيانات وأعد الإرسال من لوحة التحكم — نراجعها خلال 24 ساعة.`,
    });
    return { ok: true };
  }

  // ---- 14.4 طابور استثناءات المطابقة (القسم 24.1) ----
  exceptions() {
    return this.prisma.paymentEvent.findMany({
      where: { status: "EXCEPTION" },
      include: { matchedInvoice: { select: { reference: true, storeId: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  }

  /** حل استثناء: قيد المبلغ لمحفظة تاجر محدد، أو إهماله موثقاً */
  async resolveException(
    id: string,
    action: "CREDIT_WALLET" | "IGNORE",
    storeId: string | undefined,
    note: string | undefined,
    adminId: string,
  ) {
    const event = await this.prisma.paymentEvent.findUnique({ where: { id } });
    if (!event || event.status !== "EXCEPTION") {
      throw new NotFoundException("الاستثناء غير موجود أو حُل سابقاً");
    }
    if (action === "CREDIT_WALLET") {
      const targetStore = storeId ?? event.matchedInvoiceId
        ? storeId ??
          (await this.prisma.invoice.findUnique({ where: { id: event.matchedInvoiceId! } }))!.storeId
        : undefined;
      if (!targetStore) throw new BadRequestException("حدد المتجر المستفيد");
      await this.billing.creditWallet(
        targetStore,
        new Prisma.Decimal(event.amount),
        "CREDIT",
        `تسوية استثناء دفع يدوية${note ? ` — ${note}` : ""} (بواسطة الإدارة)`,
        `exception-${event.id}`,
        event.id,
      );
      await this.billing.attemptAutoPayFromWallet(targetStore);
    }
    return this.prisma.paymentEvent.update({
      where: { id },
      data: {
        status: action === "CREDIT_WALLET" ? "MATCHED" : "DUPLICATE",
        error: `${event.error ?? ""} | حُل يدوياً (${action}) بواسطة ${adminId}${note ? `: ${note}` : ""}`,
        processedAt: new Date(),
      },
    });
  }

  // ---- 14.3 النزاعات ----
  disputes(status: "OPEN" | "RESOLVED" | "REJECTED" = "OPEN") {
    return this.prisma.dispute.findMany({
      where: { status },
      include: {
        store: { select: { name: true, slug: true, owner: { select: { phone: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  }

  async resolveDispute(id: string, resolve: boolean, resolution: string, adminId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { store: { include: { owner: true } } },
    });
    if (!dispute || dispute.status !== "OPEN") {
      throw new NotFoundException("النزاع غير موجود أو حُل سابقاً");
    }
    const order = await this.prisma.order.findUnique({ where: { id: dispute.orderId } });
    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: resolve ? "RESOLVED" : "REJECTED",
        resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });
    // إشعار الطرفين — كل القرارات مسجّلة باسم الموظف (القسم 14.3)
    await Promise.allSettled([
      this.notifications.enqueue({
        storeId: dispute.storeId,
        recipient: dispute.store.owner.phone,
        template: "DISPUTE_RESOLVED",
        body: `قرار في النزاع على الطلب ${order?.code}:\n${resolution}`,
      }),
      ...(order
        ? [
            this.notifications.enqueue({
              storeId: dispute.storeId,
              orderId: order.id,
              recipient: order.customerPhone,
              template: "DISPUTE_RESOLVED",
              body: `مرحباً ${order.customerName} 👋\nصدر قرار في نزاعك على الطلب ${order.code}:\n${resolution}\nشكراً لصبرك 🙏`,
            }),
          ]
        : []),
    ]);
    return updated;
  }

  // ---- التقييمات المبلَّغ عنها ----
  reportedReviews() {
    return this.prisma.review.findMany({
      where: { status: "REPORTED" },
      include: { store: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  }

  setReviewStatus(id: string, status: "VISIBLE" | "HIDDEN") {
    return this.prisma.review.update({ where: { id }, data: { status } });
  }
}
