// سكربت تعبئة بيانات تجريبية لمُعين — يستدعي الـAPI الحيّة فيمرّ بكل المنطق
// (محفظة بالقيد المزدوج، اشتراك، منتجات، طلب). شغّل الخلفية أولاً ثم: node scripts/seed.mjs
const API = process.env.API_URL || "http://localhost:3000";

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data?.message ?? ""}`);
  return data;
}

async function main() {
  // تأكّد أن الخلفية تعمل
  await call("/health").catch(() => {
    throw new Error(`لا يمكن الوصول للخلفية على ${API} — شغّلها أولاً (pnpm dev:api)`);
  });

  const phone = "+967771234567";
  const password = "demo1234";

  // تاجر تجريبي (إن كان موجوداً نسجّل الدخول)
  let token, merchantId;
  try {
    const onboarded = await call("/merchants/onboard", {
      method: "POST",
      body: {
        phone,
        password,
        fullName: "عبدالله الصبري",
        businessName: "بقالة الصبري",
        governorate: "صنعاء",
      },
    });
    token = onboarded.accessToken;
    merchantId = onboarded.merchantId;
    console.log("✓ أُنشئ تاجر تجريبي");
  } catch {
    const login = await call("/auth/login", { method: "POST", body: { phone, password } });
    token = login.accessToken;
    console.log("✓ التاجر التجريبي موجود — تم الدخول");
  }

  const me = await call("/merchants/me", { token });
  merchantId = me.id;
  const storeId = me.store.id;

  // شحن المحفظة
  await call(`/merchants/${merchantId}/wallet/topup`, {
    method: "POST",
    token,
    body: { amountMinor: "50000", reference: `seed-${Date.now()}` },
  });

  // منتجات
  const products = [
    { name: "عسل سدر دوعني (نصف كيلو)", priceMinor: 18000, stock: 15 },
    { name: "تمر سكري فاخر (كيلو)", priceMinor: 4500, stock: 40 },
    { name: "بن يمني مطحون (250غ)", priceMinor: 6000, stock: 25 },
    { name: "زبيب أحمر (كيلو)", priceMinor: 3000, stock: 30 },
  ];
  const existing = await call(`/stores/${storeId}/products?all=1`, { token });
  if ((existing.items ?? existing).length === 0) {
    for (const p of products) {
      await call(`/stores/${storeId}/products`, { method: "POST", token, body: p });
    }
    console.log("✓ أُضيفت المنتجات");
  }

  console.log("\n========================================");
  console.log("  جاهز للتجربة 🎉");
  console.log("========================================");
  console.log(`  الواجهة:        http://localhost:3001`);
  console.log(`  دخول التاجر:    ${phone}  /  ${password}`);
  console.log(`  صفحة متجرك:     http://localhost:3001/store/${storeId}`);
  console.log("========================================\n");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
