import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService, type AuthResult } from "../auth/auth.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import type { OnboardMerchantDto } from "./dto.js";

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * تسجيل تاجر جديد: ينشئ المستخدم (دور MERCHANT) والتاجر في معاملة واحدة،
   * ثم يُهيّئ حسابات محفظته في دفتر الأستاذ آلياً، ويُصدر توكن دخول.
   */
  async onboard(dto: OnboardMerchantDto): Promise<AuthResult & { merchantId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException("رقم الجوال مسجّل مسبقاً");

    const { user, merchant } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          passwordHash: await AuthService.hash(dto.password),
          fullName: dto.fullName,
          role: "MERCHANT",
        },
      });
      const merchant = await tx.merchant.create({
        data: {
          userId: user.id,
          businessName: dto.businessName,
          governorate: dto.governorate,
          status: "PENDING",
        },
      });
      return { user, merchant };
    });

    // تهيئة حسابات المحفظة في الدفتر (idempotent).
    await this.wallet.ensureAccounts(merchant.id);

    return { ...this.auth.issue(user), merchantId: merchant.id };
  }

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException("لا يوجد حساب تاجر لهذا المستخدم");
    return this.findById(merchant.id);
  }

  async findById(id: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: { user: { select: { phone: true, fullName: true } } },
    });
    if (!merchant) throw new NotFoundException("التاجر غير موجود");
    const balanceMinor = await this.wallet.balance(id).catch(() => 0n);
    return { ...merchant, walletBalanceMinor: balanceMinor.toString() };
  }

  async list() {
    return this.prisma.merchant.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        businessName: true,
        governorate: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
