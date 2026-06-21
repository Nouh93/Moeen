import { Injectable, NotFoundException } from "@nestjs/common";
import type { Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateProductDto, UpdateProductDto } from "./dto.js";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: string, dto: CreateProductDto): Promise<Product> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    return this.prisma.product.create({
      data: {
        storeId,
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        priceMinor: BigInt(dto.priceMinor),
        stock: dto.stock ?? 0,
      },
    });
  }

  /** منتجات متجر (للواجهة الأمامية) — النشطة فقط افتراضياً. */
  async listByStore(storeId: string, includeInactive = false): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException("المنتج غير موجود");
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findById(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.priceMinor !== undefined ? { priceMinor: BigInt(dto.priceMinor) } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
