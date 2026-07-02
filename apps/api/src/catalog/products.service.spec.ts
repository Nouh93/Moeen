import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { ProductsService } from "./products.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const products = new ProductsService(prisma);

let counter = 0;

async function reset(): Promise<void> {
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}

async function seedStore(): Promise<string> {
  counter += 1;
  const user = await prisma.user.create({
    data: { phone: `+96777${String(900000 + counter)}`, fullName: "ت", role: "MERCHANT" },
  });
  const merchant = await prisma.merchant.create({
    data: { userId: user.id, businessName: "م", governorate: "صنعاء" },
  });
  const store = await prisma.store.create({
    data: { merchantId: merchant.id, name: "متجر", slug: `st-${counter}-${Date.now()}` },
  });
  return store.id;
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("ProductsService", () => {
  beforeEach(reset);

  it("ينشئ منتجاً ويُدرجه ضمن متجره", async () => {
    const storeId = await seedStore();
    const created = await products.create(storeId, { name: "تمر", priceMinor: 2500, stock: 10 });
    expect(created.priceMinor).toBe(2500n);

    const list = await products.listByStore(storeId);
    expect(list.total).toBe(1);
    expect(list.items[0]!.name).toBe("تمر");
  });

  it("يُخفي المنتجات غير النشطة افتراضياً", async () => {
    const storeId = await seedStore();
    const p = await products.create(storeId, { name: "عسل", priceMinor: 5000 });
    await products.update(p.id, { isActive: false });
    expect((await products.listByStore(storeId)).total).toBe(0);
    expect((await products.listByStore(storeId, true)).total).toBe(1);
  });

  it("يرفض الإنشاء على متجر غير موجود", async () => {
    await expect(
      products.create("00000000-0000-0000-0000-000000000000", { name: "x", priceMinor: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
