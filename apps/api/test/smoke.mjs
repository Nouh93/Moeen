/**
 * اختبارات دخانية للمسارات الحرجة — تعمل على API حي:
 *   pnpm --filter @moeen/api test:smoke
 * تغطي: OTP، عزل المستأجرين، idempotency الطلبات والمدفوعات،
 * الكوبونات، حدود الباقات، حارس الإدارة.
 */
import assert from "node:assert/strict";
import test from "node:test";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEBHOOK_SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? "dev-webhook-secret";

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function login(phone) {
  const otp = await call("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  assert.equal(otp.status, 201);
  const verify = await call("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code: otp.body.devCode }),
  });
  assert.equal(verify.status, 201);
  return verify.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test("المحافظات الـ 22 متاحة للعموم", async () => {
  const res = await call("/public/yemen/governorates");
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 22);
});

test("OTP: رمز خاطئ يُرفض", async () => {
  await call("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: "777000111" }),
  });
  const res = await call("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: "777000111", code: "000000" }),
  });
  assert.equal(res.status, 401);
});

test("عزل المستأجرين: تاجر لا يقرأ منتجات متجر غيره", async () => {
  const tokenA = await login("777000222");
  const tokenB = await login("777000333");
  const storeA = await call("/stores", {
    method: "POST",
    headers: auth(tokenA),
    body: JSON.stringify({ name: `متجر-أ-${Date.now()}` }),
  });
  assert.equal(storeA.status, 201);
  const breach = await call(`/stores/${storeA.body.id}/products`, {
    headers: auth(tokenB),
  });
  assert.equal(breach.status, 403);
});

test("الطلب: idempotency لا يكرر، والكوبون الوهمي يُرفض", async () => {
  const store = await call("/public/stores/alafia");
  assert.equal(store.status, 200);
  const product = store.body.products.find((p) => !p.trackStock || p.stock > 0);
  const payload = {
    customerName: "اختبار آلي",
    customerPhone: "778812345",
    governorateId: store.body.governorateId ?? 1,
    neighborhood: "حي الاختبار",
    addressDetails: "بجانب مبنى الاختبار",
    idempotencyKey: `smoke-${Date.now()}`,
    items: [{ productId: product.id, quantity: 1 }],
  };
  const first = await call("/public/stores/alafia/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.duplicate, false);
  const second = await call("/public/stores/alafia/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(second.body.duplicate, true);
  assert.equal(second.body.order.code, first.body.order.code);

  const badCoupon = await call("/public/stores/alafia/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code: "GHOST-COUPON", subtotal: 10000 }),
  });
  assert.equal(badCoupon.status, 400);
});

test("الفوترة: تكرار إشعار الدفع لا يُفعّل مرتين", async () => {
  const externalId = `SMOKE-${Date.now()}`;
  const body = JSON.stringify({ externalId, reference: "MOEEN-NONE-X", amount: 500 });
  const headers = { "x-moeen-webhook-secret": WEBHOOK_SECRET };
  const first = await call("/webhooks/payments/aggregator", { method: "POST", headers, body });
  assert.equal(first.body.duplicate, false);
  const second = await call("/webhooks/payments/aggregator", { method: "POST", headers, body });
  assert.equal(second.body.duplicate, true);
});

test("webhook بدون توقيع صحيح يُرفض", async () => {
  const res = await call("/webhooks/payments/aggregator", {
    method: "POST",
    headers: { "x-moeen-webhook-secret": "wrong" },
    body: JSON.stringify({ externalId: "x", amount: 1 }),
  });
  assert.equal(res.status, 401);
});

test("حارس الإدارة: تاجر عادي يُرفض بـ 403", async () => {
  const token = await login("777000444");
  const res = await call("/admin/overview", { headers: auth(token) });
  assert.equal(res.status, 403);
});

test("حدود الباقة المجانية: الكوبونات مقفلة", async () => {
  const token = await login("777000555");
  const store = await call("/stores", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ name: `متجر-مجاني-${Date.now()}` }),
  });
  const coupon = await call(`/stores/${store.body.id}/coupons`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ code: "TEST10", type: "PERCENT", value: 10 }),
  });
  assert.equal(coupon.status, 400);
  assert.match(coupon.body.message, /نمو/);
});
