import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Store } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    merchantId: string,
    input: { name: string; merchantPaysShipping?: boolean },
  ): Promise<Store> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException("التاجر غير موجود");

    return this.prisma.store.create({
      data: {
        merchantId,
        name: input.name,
        slug: `store-${randomUUID().slice(0, 8)}`,
        merchantPaysShipping: input.merchantPaysShipping ?? false,
      },
    });
  }

  async findById(id: string): Promise<Store> {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    return store;
  }
}
