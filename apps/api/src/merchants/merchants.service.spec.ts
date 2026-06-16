import { ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "../auth/auth.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import { MerchantsService } from "./merchants.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const jwt = new JwtService({ secret: "test-secret", signOptions: { expiresIn: "1h" } });
const auth = new AuthService(prisma, jwt);
const ledger = new LedgerService(prisma);
const wallet = new WalletService(ledger);
const merchants = new MerchantsService(prisma, auth, wallet);

async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

const dto = {
  phone: "+967771112233",
  password: "secret123",
  fullName: "تاجر",
  businessName: "متجر النور",
  governorate: "تعز",
};

d("MerchantsService — onboarding متكامل", () => {
  beforeEach(reset);

  it("ينشئ مستخدماً وتاجراً وحسابات محفظة ويُصدر توكناً صالحاً", async () => {
    const result = await merchants.onboard(dto);

    expect(result.user.role).toBe("MERCHANT");
    expect(result.merchantId).toBeTruthy();
    // التوكن صالح ويحمل هوية التاجر.
    const payload = auth.verify(result.accessToken);
    expect(payload.phone).toBe(dto.phone);
    expect(payload.role).toBe("MERCHANT");

    // حساب المحفظة أُنشئ آلياً برصيد صفري.
    const balance = await wallet.balance(result.merchantId);
    expect(balance).toBe(0n);

    // التاجر قابل للجلب مع رصيد المحفظة.
    const fetched = await merchants.findById(result.merchantId);
    expect(fetched.businessName).toBe(dto.businessName);
    expect(fetched.walletBalanceMinor).toBe("0");
  });

  it("يرفض تكرار رقم الجوال", async () => {
    await merchants.onboard(dto);
    await expect(merchants.onboard(dto)).rejects.toBeInstanceOf(ConflictException);
    // لم يُنشأ تاجر ثانٍ.
    expect(await prisma.merchant.count()).toBe(1);
  });

  it("المحفظة المُهيّأة تقبل الشحن مباشرةً بعد التسجيل", async () => {
    const { merchantId } = await merchants.onboard(dto);
    await wallet.topUp(merchantId, 5000n, "first-topup");
    expect(await wallet.balance(merchantId)).toBe(5000n);
  });
});

d("AuthService — تسجيل ودخول", () => {
  beforeEach(reset);

  it("يُسجّل ثم يسمح بالدخول بكلمة المرور الصحيحة فقط", async () => {
    await auth.register({ phone: "+967770000009", password: "pass123", fullName: "زبون" });
    const ok = await auth.login("+967770000009", "pass123");
    expect(ok.user.role).toBe("CUSTOMER");
    await expect(auth.login("+967770000009", "wrong")).rejects.toThrow();
  });
});
