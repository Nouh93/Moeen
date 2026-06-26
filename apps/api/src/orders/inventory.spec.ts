import { ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "../auth/auth.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { WalletService } from "../wallet/wallet.service.js";
import { SubscriptionsService } from "../billing/subscriptions.service.js";
import { MerchantsService } from "../merchants/merchants.service.js";
import { PricingService } from "./pricing.js";
import { OrdersService } from "./orders.service.js";
import { ShippingService } from "../shipping/shipping.service.js";
import { ProductsService } from "../catalog/products.service.js";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaService();
const jwt = new JwtService({ secret: "t", signOptions: { expiresIn: "1h" } });
const auth = new AuthService(prisma, jwt);
const ledger = new LedgerService(prisma);
const accounts = new AccountsService(ledger);
const wallet = new WalletService(ledger, accounts);
const subs = new SubscriptionsService(prisma, ledger, accounts);
const merchants = new MerchantsService(prisma, auth, wallet, subs);
const pricing = new PricingService();
const orders = new OrdersService(prisma, ledger, accounts, pricing);
const shipping = new ShippingService(prisma, ledger, accounts, pricing, orders);
const products = new ProductsService(prisma);

let counter = 0;
async function reset(): Promise<void> {
  await prisma.ledgerPosting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

async function seed(stock: number) {
  counter += 1;
  const { merchantId, storeId } = await merchants.onboard({
    phone: `+96777${String(200000 + counter)}`,
    password: "secret123",
    fullName: "ت",
    businessName: "م",
    governorate: "صنعاء",
  });
  const cUser = await prisma.user.create({
    data: { phone: `+96773${String(200000 + counter)}`, fullName: "ع", role: "CUSTOMER" },
  });
  const customer = await prisma.customer.create({ data: { userId: cUser.id } });
  const product = await products.create(storeId, { name: "تمر", priceMinor: 5000, stock });
  return { merchantId, storeId, customerId: customer.id, productId: product.id };
}

afterAll(async () => {
  if (hasDb) await reset();
  await prisma.$disconnect();
});

const stockOf = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } }).then((p) => p.stock);

d("المخزون — خصم ذرّي ومنع البيع الزائد", () => {
  beforeEach(reset);

  it("يخصم المخزون عند الطلب", async () => {
    const { storeId, customerId, productId } = await seed(10);
    await orders.place({
      storeId,
      customerId,
      paymentMethod: "COD",
      shippingMinor: 0,
      items: [{ productId, name: "x", unitPriceMinor: 1, quantity: 3 }],
    });
    expect(await stockOf(productId)).toBe(7);
  });

  it("يرفض الطلب إن تجاوزت الكمية المخزون ولا يُنشئ طلباً", async () => {
    const { storeId, customerId, productId } = await seed(2);
    await expect(
      orders.place({
        storeId,
        customerId,
        paymentMethod: "COD",
        shippingMinor: 0,
        items: [{ productId, name: "x", unitPriceMinor: 1, quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await stockOf(productId)).toBe(2); // لم يتغيّر
    expect(await prisma.order.count()).toBe(0);
  });

  it("التزامن: 10 طلبات على مخزون 5 → 5 تنجح فقط بلا بيع زائد", async () => {
    const { storeId, customerId, productId } = await seed(5);
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        orders.place({
          storeId,
          customerId,
          paymentMethod: "COD",
          shippingMinor: 0,
          items: [{ productId, name: "x", unitPriceMinor: 1, quantity: 1 }],
        }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect(await stockOf(productId)).toBe(0);
  });

  it("الإلغاء يُعيد المخزون", async () => {
    const { storeId, customerId, productId } = await seed(10);
    const order = await orders.place({
      storeId,
      customerId,
      paymentMethod: "COD",
      shippingMinor: 0,
      items: [{ productId, name: "x", unitPriceMinor: 1, quantity: 4 }],
    });
    expect(await stockOf(productId)).toBe(6);
    await shipping.createWaybill(order.id);
    await shipping.cancel(order.id);
    expect(await stockOf(productId)).toBe(10);
  });
});
