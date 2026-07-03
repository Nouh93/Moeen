import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
  ) {}

  async list(storeId: string, ownerId: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    return this.prisma.coupon.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    storeId: string,
    ownerId: string,
    data: {
      code: string;
      type: "PERCENT" | "FIXED";
      value: number;
      minOrder?: number;
      maxUses?: number;
      expiresAt?: string;
    },
  ) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    if (data.type === "PERCENT" && (data.value <= 0 || data.value > 100)) {
      throw new BadRequestException("نسبة الخصم يجب أن تكون بين 1 و 100");
    }
    try {
      return await this.prisma.coupon.create({
        data: {
          storeId,
          code: data.code.trim().toUpperCase(),
          type: data.type,
          value: data.value,
          minOrder: data.minOrder,
          maxUses: data.maxUses,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("يوجد كوبون بنفس الكود في متجرك");
      }
      throw e;
    }
  }

  async toggle(storeId: string, ownerId: string, id: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, storeId },
    });
    if (!coupon) throw new NotFoundException("الكوبون غير موجود");
    return this.prisma.coupon.update({
      where: { id },
      data: { active: !coupon.active },
    });
  }

  /**
   * التحقق من صلاحية كوبون وحساب الخصم على مبلغ معيّن.
   * تُستخدم من صفحة السلة (معاينة) ومن إنشاء الطلب (نهائي).
   */
  async validate(storeId: string, code: string, subtotal: Prisma.Decimal) {
    const coupon = await this.prisma.coupon.findUnique({
      where: {
        storeId_code: { storeId, code: code.trim().toUpperCase() },
      },
    });
    if (!coupon || !coupon.active) {
      throw new BadRequestException("الكوبون غير صحيح أو غير مفعّل");
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException("انتهت صلاحية هذا الكوبون");
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException("اكتمل عدد استخدامات هذا الكوبون");
    }
    if (coupon.minOrder && subtotal.lt(coupon.minOrder)) {
      throw new BadRequestException(
        `الكوبون يشترط حداً أدنى للطلب ${Number(coupon.minOrder).toLocaleString("ar-YE")}`,
      );
    }
    const discount =
      coupon.type === "PERCENT"
        ? subtotal.mul(coupon.value).div(100)
        : Prisma.Decimal.min(new Prisma.Decimal(coupon.value), subtotal);
    return { coupon, discount };
  }

  /** تسجيل استخدام الكوبون — داخل معاملة إنشاء الطلب */
  consume(tx: Prisma.TransactionClient, couponId: string) {
    return tx.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
