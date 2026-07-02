import { Injectable, NotFoundException } from "@nestjs/common";
import type { MerchantStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { parsePage, toPage } from "../common/pagination.js";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [merchantsTotal, merchantsActive, merchantsSuspended, ordersTotal, ordersDelivered] =
      await Promise.all([
        this.prisma.merchant.count(),
        this.prisma.merchant.count({ where: { status: "ACTIVE" } }),
        this.prisma.merchant.count({ where: { status: "SUSPENDED" } }),
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: "DELIVERED" } }),
      ]);

    const revenueAccounts = await this.prisma.ledgerAccount.findMany({
      where: { type: "REVENUE" },
      select: { balanceMinor: true },
    });
    const platformRevenueMinor = revenueAccounts
      .reduce((s, a) => s + a.balanceMinor, 0n)
      .toString();

    const exceptions = await this.prisma.payment.count({ where: { status: "EXCEPTION" } });

    return {
      merchantsTotal,
      merchantsActive,
      merchantsSuspended,
      ordersTotal,
      ordersDelivered,
      platformRevenueMinor,
      paymentExceptions: exceptions,
    };
  }

  async listMerchants(page?: string, perPage?: string) {
    const p = parsePage(page, perPage);
    const select = {
      id: true,
      businessName: true,
      governorate: true,
      status: true,
      kycLevel: true,
      trustedBadge: true,
      featuredBadge: true,
      createdAt: true,
      user: { select: { phone: true } },
    };
    const [items, total] = await Promise.all([
      this.prisma.merchant.findMany({ orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take, select }),
      this.prisma.merchant.count(),
    ]);
    return toPage(items, total, p);
  }

  /** يضبط حالة التاجر يدوياً ويُزامن ظهور متاجره. */
  async setStatus(id: string, status: MerchantStatus) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException("التاجر غير موجود");
    const visible = status === "ACTIVE";
    await this.prisma.$transaction([
      this.prisma.merchant.update({ where: { id }, data: { status } }),
      this.prisma.store.updateMany({ where: { merchantId: id }, data: { isVisible: visible } }),
    ]);
    return { id, status };
  }

  async setBadges(id: string, badges: { trusted?: boolean; featured?: boolean }) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException("التاجر غير موجود");
    return this.prisma.merchant.update({
      where: { id },
      data: {
        ...(badges.trusted !== undefined ? { trustedBadge: badges.trusted } : {}),
        ...(badges.featured !== undefined ? { featuredBadge: badges.featured } : {}),
      },
      select: { id: true, trustedBadge: true, featuredBadge: true },
    });
  }

  async exceptions() {
    return this.prisma.payment.findMany({
      where: { status: "EXCEPTION" },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  }
}
