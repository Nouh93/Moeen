import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService, type AuthResult } from "../auth/auth.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import { SubscriptionsService } from "../billing/subscriptions.service.js";
import type { OnboardMerchantDto } from "./dto.js";

/** سعر الاشتراك الشهري الافتراضي (ريال يمني). قابل للضبط لاحقاً. */
const DEFAULT_SUBSCRIPTION_PRICE = 5000n;

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * تسجيل تاجر جديد: ينشئ المستخدم (دور MERCHANT) والتاجر **ومتجره الوحيد** في
   * معاملة واحدة (نموذج: تاجر = متجر واحد)، ثم يُهيّئ حسابات المحفظة ويُصدر توكناً.
   */
  async onboard(
    dto: OnboardMerchantDto,
  ): Promise<AuthResult & { merchantId: string; storeId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException("رقم الجوال مسجّل مسبقاً");

    const { user, merchant, store } = await this.prisma.$transaction(async (tx) => {
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
      // متجر التاجر الوحيد — يُنشأ تلقائياً باسم النشاط.
      const store = await tx.store.create({
        data: {
          merchantId: merchant.id,
          name: dto.businessName,
          slug: `store-${randomUUID().slice(0, 8)}`,
          merchantPaysShipping: false,
        },
      });
      return { user, merchant, store };
    });

    // تهيئة حسابات المحفظة في الدفتر (idempotent) + إنشاء اشتراك شهري نشط.
    await this.wallet.ensureAccounts(merchant.id);
    await this.subscriptions.createSubscription(merchant.id, DEFAULT_SUBSCRIPTION_PRICE);

    return { ...this.auth.issue(user), merchantId: merchant.id, storeId: store.id };
  }

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException("لا يوجد حساب تاجر لهذا المستخدم");
    return this.findById(merchant.id);
  }

  async findById(id: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true, fullName: true } },
        stores: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, name: true, slug: true, merchantPaysShipping: true },
        },
      },
    });
    if (!merchant) throw new NotFoundException("التاجر غير موجود");
    const balanceMinor = await this.wallet.balance(id).catch(() => 0n);
    const subscription = await this.prisma.subscription.findFirst({
      where: { merchantId: id },
      orderBy: { createdAt: "desc" },
      select: { status: true, priceMinor: true },
    });
    const { stores, ...rest } = merchant;
    // تاجر = متجر واحد: نُعيد المتجر الوحيد مباشرةً.
    return {
      ...rest,
      store: stores[0] ?? null,
      walletBalanceMinor: balanceMinor.toString(),
      subscription: subscription
        ? { status: subscription.status, priceMinor: subscription.priceMinor.toString() }
        : null,
    };
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
