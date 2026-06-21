import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminService } from "./admin.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const admin = new AdminService(prisma);

let counter = 0;
async function reset(): Promise<void> {
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
}
async function seedMerchant(): Promise<string> {
  counter += 1;
  const user = await prisma.user.create({
    data: { phone: `+96777${String(800000 + counter)}`, fullName: "ت", role: "MERCHANT" },
  });
  const merchant = await prisma.merchant.create({
    data: { userId: user.id, businessName: "م", governorate: "صنعاء", status: "PENDING" },
  });
  await prisma.store.create({
    data: { merchantId: merchant.id, name: "متجر", slug: `a-${counter}-${Date.now()}`, isVisible: false },
  });
  return merchant.id;
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("AdminService", () => {
  beforeEach(reset);

  it("يفعّل التاجر ويُظهر متجره", async () => {
    const id = await seedMerchant();
    await admin.setStatus(id, "ACTIVE");
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
    expect((await prisma.store.findFirstOrThrow({ where: { merchantId: id } })).isVisible).toBe(true);
  });

  it("يعلّق التاجر ويُخفي متجره", async () => {
    const id = await seedMerchant();
    await admin.setStatus(id, "ACTIVE");
    await admin.setStatus(id, "SUSPENDED");
    expect((await prisma.store.findFirstOrThrow({ where: { merchantId: id } })).isVisible).toBe(false);
  });

  it("يمنح الشارات", async () => {
    const id = await seedMerchant();
    const res = await admin.setBadges(id, { trusted: true, featured: true });
    expect(res.trustedBadge).toBe(true);
    expect(res.featuredBadge).toBe(true);
  });

  it("يحسب الإحصاءات", async () => {
    await seedMerchant();
    const stats = await admin.stats();
    expect(stats.merchantsTotal).toBeGreaterThanOrEqual(1);
    expect(stats).toHaveProperty("platformRevenueMinor");
  });
});
