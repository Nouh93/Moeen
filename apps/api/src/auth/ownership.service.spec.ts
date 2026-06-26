import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { OwnershipService } from "./ownership.service.js";
import type { JwtPayload } from "./auth.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const ownership = new OwnershipService(prisma);

let counter = 0;
async function reset(): Promise<void> {
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}
async function seedMerchant() {
  counter += 1;
  const user = await prisma.user.create({
    data: { phone: `+96777${String(400000 + counter)}`, fullName: "ت", role: "MERCHANT" },
  });
  const merchant = await prisma.merchant.create({
    data: { userId: user.id, businessName: "م", governorate: "صنعاء" },
  });
  const store = await prisma.store.create({
    data: { merchantId: merchant.id, name: "متجر", slug: `o-${counter}-${Date.now()}` },
  });
  const product = await prisma.product.create({
    data: { storeId: store.id, name: "س", priceMinor: 100n },
  });
  const payload: JwtPayload = { sub: user.id, phone: user.phone, role: "MERCHANT" };
  return { user: payload, merchantId: merchant.id, storeId: store.id, productId: product.id };
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("OwnershipService", () => {
  beforeEach(reset);

  it("يمنع تاجراً من العبث بموارد تاجر آخر", async () => {
    const a = await seedMerchant();
    const b = await seedMerchant();
    await expect(ownership.assertOwnsMerchant(b.user, a.merchantId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ownership.assertOwnsStore(b.user, a.storeId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ownership.assertOwnsProduct(b.user, a.productId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("يسمح للمالك بموارده", async () => {
    const a = await seedMerchant();
    await expect(ownership.assertOwnsMerchant(a.user, a.merchantId)).resolves.toBeUndefined();
    await expect(ownership.assertOwnsStore(a.user, a.storeId)).resolves.toBeUndefined();
    await expect(ownership.assertOwnsProduct(a.user, a.productId)).resolves.toBeUndefined();
  });

  it("المشرف يتجاوز التحقّق", async () => {
    const a = await seedMerchant();
    const admin: JwtPayload = { sub: "x", phone: "+967700000000", role: "SUPER_ADMIN" };
    await expect(ownership.assertOwnsMerchant(admin, a.merchantId)).resolves.toBeUndefined();
  });
});
