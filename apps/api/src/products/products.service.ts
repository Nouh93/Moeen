import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PLANS, PlanId } from "@moeen/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
  ) {}

  async list(storeId: string, ownerId: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    return this.prisma.product.findMany({
      where: { storeId },
      include: { category: true, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(storeId: string, ownerId: string, data: any) {
    const store = await this.stores.ownedByOrThrow(storeId, ownerId);
    // حدود الباقة (القسم 3.2) — برسالة ودية تقترح الترقية، لا تُخيف (القسم 26.1)
    const limit = PLANS[store.plan as PlanId].maxProducts;
    if (Number.isFinite(limit)) {
      const count = await this.prisma.product.count({
        where: { storeId, status: { not: "HIDDEN" } },
      });
      if (count >= limit) {
        throw new BadRequestException(
          `وصلت حد باقتك المجانية (${limit} منتجاً) 🎉 متجرك يكبر! رقِّ لباقة "نمو" من تبويب الاشتراك لمنتجات بلا حدود`,
        );
      }
    }
    const { variants, ...productData } = data;
    return this.prisma.product.create({
      data: {
        ...productData,
        storeId,
        ...(variants?.length
          ? {
              variants: {
                create: variants.map((v: any, i: number) => ({
                  name: v.name,
                  price: v.price ?? null,
                  stock: v.stock ?? 0,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
      include: { variants: true },
    });
  }

  async update(storeId: string, ownerId: string, id: string, data: any) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
    });
    if (!product) throw new NotFoundException("المنتج غير موجود");
    const { variants, ...productData } = data;
    return this.prisma.$transaction(async (tx) => {
      // مزامنة الخيارات: تحديث الموجود، إنشاء الجديد، حذف المزال
      if (variants !== undefined) {
        const keepIds = variants.filter((v: any) => v.id).map((v: any) => v.id);
        await tx.productVariant.deleteMany({
          where: {
            productId: id,
            id: { notIn: keepIds },
            orderItems: { none: {} }, // لا نحذف خياراً مرتبطاً بطلبات
          },
        });
        for (const [i, v] of variants.entries()) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { name: v.name, price: v.price ?? null, stock: v.stock ?? 0, sortOrder: i },
            });
          } else {
            await tx.productVariant.create({
              data: { productId: id, name: v.name, price: v.price ?? null, stock: v.stock ?? 0, sortOrder: i },
            });
          }
        }
      }
      return tx.product.update({
        where: { id },
        data: productData,
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      });
    });
  }

  async remove(storeId: string, ownerId: string, id: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
    });
    if (!product) throw new NotFoundException("المنتج غير موجود");
    // إخفاء بدل حذف فعلي — الطلبات القديمة تشير للمنتج
    return this.prisma.product.update({
      where: { id },
      data: { status: "HIDDEN" },
    });
  }
}
