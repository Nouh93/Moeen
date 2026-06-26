import { BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "../auth/auth.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import { MerchantsService } from "../merchants/merchants.service.js";
import { SubscriptionsService } from "../billing/subscriptions.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { PricingService } from "../orders/pricing.js";
import { ShippingService } from "./shipping.service.js";
import {
  merchantHold,
  merchantSettlement,
  merchantWallet,
  PlatformAccounts,
} from "../ledger/accounts.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const jwt = new JwtService({ secret: "t", signOptions: { expiresIn: "1h" } });
const auth = new AuthService(prisma, jwt);
const ledger = new LedgerService(prisma);
const accounts = new AccountsService(ledger);
const wallet = new WalletService(ledger, accounts);
const pricing = new PricingService();
const subscriptions = new SubscriptionsService(prisma, ledger, accounts);
const merchants = new MerchantsService(prisma, auth, wallet, subscriptions, ledger);
const orders = new OrdersService(prisma, ledger, accounts, pricing);
const shipping = new ShippingService(prisma, ledger, accounts, pricing, orders);

let counter = 0;

async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

async function seed(): Promise<{ merchantId: string; storeId: string; customerId: string }> {
  counter += 1;
  const { merchantId } = await merchants.onboard({
    phone: `+96777000${String(1000 + counter)}`,
    password: "secret123",
    fullName: "تاجر",
    businessName: "متجر",
    governorate: "صنعاء",
  });
  const store = await prisma.store.create({
    data: { merchantId, name: "متجر", slug: `s-${counter}-${Date.now()}` },
  });
  const cUser = await prisma.user.create({
    data: { phone: `+96773000${String(1000 + counter)}`, fullName: "عميل", role: "CUSTOMER" },
  });
  const customer = await prisma.customer.create({ data: { userId: cUser.id } });
  return { merchantId, storeId: store.id, customerId: customer.id };
}

const bal = (code: string) => ledger.balanceOf(code);

/** يتحقّق من معادلة المحاسبة: مجموع الأرصدة الموقّعة = 0 لكل عملة. */
async function assertBalanced(): Promise<void> {
  const all = await prisma.ledgerAccount.findMany();
  let signed = 0n;
  for (const a of all) {
    const sign = a.type === "ASSET" || a.type === "EXPENSE" ? 1n : -1n;
    signed += sign * a.balanceMinor;
  }
  expect(signed).toBe(0n);
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

d("ShippingService — التدفقات المالية الكاملة (PRD 24.8)", () => {
  beforeEach(reset);

  it("COD + العميل يدفع الشحن: التسوية عند التسليم لا تمسّ المحفظة", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "COD",
      shippingMinor: 1000,
      merchantPaysShipping: false,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    // لا قيد عند الإنشاء.
    expect(await bal(merchantSettlement(merchantId))).toBe(0n);

    await shipping.createWaybill(order.id);
    expect(await bal(merchantWallet(merchantId))).toBe(0n); // لا حجز

    await shipping.confirmDelivery(order.id);
    expect(await bal(merchantSettlement(merchantId))).toBe(9750n); // 10000 − 250 عمولة
    expect(await bal(PlatformAccounts.REVENUE_COMMISSION)).toBe(250n);
    expect(await bal(PlatformAccounts.PAYABLE_CARRIER)).toBe(1000n);
    expect(await bal(PlatformAccounts.COD_CLEARING)).toBe(11000n);
    await assertBalanced();
  });

  it("COD + التاجر يتحمّل الشحن: يُصافى من تحصيل COD (قيمة − شحن − عمولة تحصيل)", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "COD",
      shippingMinor: 1000,
      merchantPaysShipping: true,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    await shipping.createWaybill(order.id);
    await shipping.confirmDelivery(order.id);

    // 10000 − 1000 شحن − 100 عمولة تحصيل = 8900
    expect(await bal(merchantSettlement(merchantId))).toBe(8900n);
    expect(await bal(PlatformAccounts.PAYABLE_CARRIER)).toBe(1000n);
    expect(await bal(PlatformAccounts.REVENUE_COLLECTION)).toBe(100n);
    expect(await bal(merchantWallet(merchantId))).toBe(0n); // المحفظة لم تُمَسّ
    await assertBalanced();
  });

  it("إلكتروني + العميل يدفع الشحن: تسوية صافية فورية عند الإنشاء", async () => {
    const { merchantId, storeId, customerId } = await seed();
    await orders.place({
      storeId,
      customerId,
      paymentMethod: "ONLINE",
      shippingMinor: 1000,
      merchantPaysShipping: false,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    // total 11000، mdr 220، عمولة 250
    expect(await bal(merchantSettlement(merchantId))).toBe(9750n);
    expect(await bal(PlatformAccounts.EXPENSE_MDR)).toBe(220n);
    expect(await bal(PlatformAccounts.PAYABLE_CARRIER)).toBe(1000n);
    expect(await bal(PlatformAccounts.PAYABLE_ACQUIRER)).toBe(220n);
    expect(await bal(PlatformAccounts.CASH)).toBe(11000n);
    await assertBalanced();
  });

  it("إلكتروني + التاجر يتحمّل الشحن: حجز عند الإنشاء وخصم فعلي عند التسليم", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "ONLINE",
      shippingMinor: 1000,
      merchantPaysShipping: true,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    // total = 10000 (العميل لا يدفع شحناً)، عمولة 250 → تسوية 9750
    expect(await bal(merchantSettlement(merchantId))).toBe(9750n);

    await shipping.createWaybill(order.id); // حجز 1000 من التسوية
    expect(await bal(merchantSettlement(merchantId))).toBe(8750n);
    expect(await bal(merchantHold(merchantId))).toBe(1000n);

    await shipping.confirmDelivery(order.id); // خصم فعلي → شركة الشحن
    expect(await bal(merchantHold(merchantId))).toBe(0n);
    expect(await bal(PlatformAccounts.PAYABLE_CARRIER)).toBe(1000n);
    await assertBalanced();
  });

  it("يرفض البوليصة إن لم يكفِ الرصيد (لا رصيد سالب) ولا يُنشئ شحنة", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "ONLINE",
      shippingMinor: 1000,
      merchantPaysShipping: true,
      items: [{ name: "منتج", unitPriceMinor: 500, quantity: 1 }], // تسوية ضئيلة
    });
    const settlementBefore = await bal(merchantSettlement(merchantId));

    await expect(shipping.createWaybill(order.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(await prisma.shipment.count()).toBe(0); // لا بوليصة
    expect(await bal(merchantSettlement(merchantId))).toBe(settlementBefore); // لم يتغيّر
    expect(await bal(merchantHold(merchantId))).toBe(0n);
    await assertBalanced();
  });

  it("بعد شحن المحفظة يُغطّى النقص ويُقبل الحجز (waterfall: تسوية ← محفظة)", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "ONLINE",
      shippingMinor: 1000,
      merchantPaysShipping: true,
      items: [{ name: "منتج", unitPriceMinor: 500, quantity: 1 }],
    });
    await wallet.topUp(merchantId, 2000n, `seed-${merchantId}`);

    const shipment = await shipping.createWaybill(order.id);
    expect(shipment.status).toBe("CREATED");
    expect(await bal(merchantHold(merchantId))).toBe(1000n);
    // الحجز أخذ من التسوية أولاً (487) ثم من المحفظة (513).
    expect(await bal(merchantSettlement(merchantId))).toBe(0n);
    expect(await bal(merchantWallet(merchantId))).toBe(2000n - 513n);
    await assertBalanced();
  });

  it("الإلغاء يحرّر الحجز ويُعيده للمحفظة (المجموع محفوظ)", async () => {
    const { merchantId, storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "ONLINE",
      shippingMinor: 1000,
      merchantPaysShipping: true,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    await shipping.createWaybill(order.id);
    await shipping.cancel(order.id);

    expect(await bal(merchantHold(merchantId))).toBe(0n);
    // التسوية 8750 + المحفظة 1000 = 9750 (نفس ما قبل الحجز).
    expect(await bal(merchantSettlement(merchantId))).toBe(8750n);
    expect(await bal(merchantWallet(merchantId))).toBe(1000n);
    await assertBalanced();
  });

  it("idempotent: تكرار التسليم وإنشاء البوليصة لا يُكرّر القيود", async () => {
    const { storeId, customerId } = await seed();
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "COD",
      shippingMinor: 1000,
      merchantPaysShipping: false,
      items: [{ name: "منتج", unitPriceMinor: 10000, quantity: 1 }],
    });
    const wb1 = await shipping.createWaybill(order.id);
    const wb2 = await shipping.createWaybill(order.id);
    expect(wb2.id).toBe(wb1.id);

    await shipping.confirmDelivery(order.id);
    const entriesAfterFirst = await prisma.journalEntry.count();
    await shipping.confirmDelivery(order.id); // تكرار
    expect(await prisma.journalEntry.count()).toBe(entriesAfterFirst);
    await assertBalanced();
  });
});
