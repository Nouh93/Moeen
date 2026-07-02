import { Injectable, NotFoundException } from "@nestjs/common";
import type { Customer } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** ينشئ ملف عميل للمستخدم إن لم يوجد (idempotent على userId). */
  async ensureForUser(userId: string): Promise<Customer> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("المستخدم غير موجود");

    const existing = await this.prisma.customer.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.customer.create({ data: { userId } });
  }
}
