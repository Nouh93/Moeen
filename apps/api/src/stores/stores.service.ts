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

  /** واجهة المتجر العامة: بيانات المتجر + منتجاته الظاهرة فقط */
  async publicBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        governorate: true,
        products: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!store || store.status !== "ACTIVE") {
      // المتجر المعلَّق يُخفى من الزوار — القسم 24.5 بالملحق
      throw new NotFoundException("المتجر غير موجود أو موقوف حالياً");
    }
    const { ownerId, ...pub } = store;
    return pub;
  }
}
