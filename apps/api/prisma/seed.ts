/**
 * بذر قاعدة البيانات:
 * 1. المحافظات اليمنية الـ 22 ومديريات مدينتَي الإطلاق (القسم 23.2 بالملحق)
 * 2. متجر تجريبي "متجر العافية" بمنتجات — للتطوير والعرض فقط
 */
import { PrismaClient } from "@prisma/client";
import { YEMEN_GOVERNORATES } from "@moeen/shared";

const prisma = new PrismaClient();

async function main() {
  for (const gov of YEMEN_GOVERNORATES) {
    const g = await prisma.governorate.upsert({
      where: { code: gov.code },
      create: { code: gov.code, nameAr: gov.nameAr },
      update: { nameAr: gov.nameAr },
    });
    for (const district of gov.districts) {
      await prisma.district.upsert({
        where: {
          governorateId_nameAr: { governorateId: g.id, nameAr: district },
        },
        create: { governorateId: g.id, nameAr: district },
        update: {},
      });
    }
  }
  console.log("✅ المحافظات والمديريات");

  // مدير المنصة (Super Admin) — القسم 14
  await prisma.user.upsert({
    where: { phone: "+967700000001" },
    create: { phone: "+967700000001", name: "إدارة مُعين", role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  console.log("✅ مدير المنصة: 700000001");

  if (process.env.SEED_DEMO !== "0") {
    const owner = await prisma.user.upsert({
      where: { phone: "+967771234567" },
      create: { phone: "+967771234567", name: "أم أحمد" },
      update: {},
    });
    const sanaa = await prisma.governorate.findUniqueOrThrow({
      where: { code: "SAN" },
    });
    const store = await prisma.store.upsert({
      where: { slug: "alafia" },
      create: {
        slug: "alafia",
        name: "متجر العافية",
        description: "عطورات وبخور يمني أصلي — توصيل لكل المحافظات",
        whatsapp: "+967771234567",
        currency: "YER_SANAA",
        governorateId: sanaa.id,
        city: "صنعاء",
        shippingFee: 1000,
        ownerId: owner.id,
      },
      update: {},
    });

    const demoProducts = [
      {
        name: "عود كمبودي فاخر — 50 جرام",
        description: "عود كمبودي درجة أولى، رائحة تدوم. تغليف هدايا مجاني.",
        price: 25000,
        compareAtPrice: 30000,
        trackStock: true,
        stock: 15,
      },
      {
        name: "دهن عود ملكي — 6 مل",
        description: "دهن عود مركّز، يكفي لشهور من الاستخدام اليومي.",
        price: 18000,
        trackStock: true,
        stock: 8,
      },
      {
        name: "بخور دوسري معطّر — 100 جرام",
        description: "خلطة بخور فاخرة للمجالس والمناسبات.",
        price: 8000,
        trackStock: false,
        stock: 0,
      },
    ];
    for (const p of demoProducts) {
      const exists = await prisma.product.findFirst({
        where: { storeId: store.id, name: p.name },
      });
      if (!exists) {
        await prisma.product.create({ data: { ...p, storeId: store.id } });
      }
    }
    console.log("✅ المتجر التجريبي: alafia (جوال التاجر 771234567)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
