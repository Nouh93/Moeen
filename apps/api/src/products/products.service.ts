import { Injectable, NotFoundException } from "@nestjs/common";
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
      orderBy: { createdAt: "desc" },
    });
  }

  async create(storeId: string, ownerId: string, data: any) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    return this.prisma.product.create({ data: { ...data, storeId } });
  }

  async update(storeId: string, ownerId: string, id: string, data: any) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
    });
    if (!product) throw new NotFoundException("المنتج غير موجود");
    return this.prisma.product.update({ where: { id }, data });
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
