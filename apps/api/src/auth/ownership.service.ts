import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { JwtPayload } from "./auth.service.js";

/**
 * تحقّق ملكية الموارد: يمنع تاجراً من العبث بموارد تاجر آخر.
 * المشرفون (SUPER_ADMIN/STAFF) يتجاوزون التحقّق.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(role: JwtPayload["role"]): boolean {
    return role === "SUPER_ADMIN" || role === "STAFF";
  }

  private deny(): never {
    throw new ForbiddenException("لا تملك صلاحية على هذا المورد");
  }

  async assertOwnsMerchant(user: JwtPayload, merchantId: string): Promise<void> {
    if (this.isAdmin(user.role)) return;
    const m = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { userId: true },
    });
    if (!m || m.userId !== user.sub) this.deny();
  }

  async assertOwnsStore(user: JwtPayload, storeId: string): Promise<void> {
    if (this.isAdmin(user.role)) return;
    const s = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { merchant: { select: { userId: true } } },
    });
    if (!s || s.merchant.userId !== user.sub) this.deny();
  }

  async assertOwnsProduct(user: JwtPayload, productId: string): Promise<void> {
    if (this.isAdmin(user.role)) return;
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { store: { select: { merchant: { select: { userId: true } } } } },
    });
    if (!p || p.store.merchant.userId !== user.sub) this.deny();
  }

  /** يملك التاجر متجر الطلب. */
  async assertOwnsOrder(user: JwtPayload, orderId: string): Promise<void> {
    if (this.isAdmin(user.role)) return;
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { store: { select: { merchant: { select: { userId: true } } } } },
    });
    if (!o || o.store.merchant.userId !== user.sub) this.deny();
  }
}
