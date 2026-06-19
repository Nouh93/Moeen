# مُعين (Moeen)

منصة تجارة وتوصيل مصمّمة لليمن: متاجر للتجار، طلبات، مندوبون، دفع عند الاستلام
(COD) ومدفوعات إلكترونية، محفظة تاجر واشتراكات، ورسائل واتساب — مع تصميم يصمد
أمام ضعف الكهرباء والإنترنت.

> الحالة: **أساس قيد البناء.** القلب المالي (دفتر الأستاذ) مُنفَّذ ومُختبَر.

## لماذا هذه المعمارية؟

الأولوية: **الثبات عند التوسّع + منطق مالي سليم 100%**. التفاصيل في
[`docs/adr/`](docs/adr/):

- **Modular Monolith** بـ **TypeScript + NestJS** — أنواع صارمة وبنية وحدات.
- **PostgreSQL 16 + Prisma** — معاملات ACID للفلوس.
- **Redis + BullMQ** — محرّك المطابقة ودورة الإنذار (غير متزامن، idempotent).
- **Next.js PWA** — واجهة تعمل أوفلاين (متطلب القسم 22 من الـPRD).
- **نقود كأعداد صحيحة + قيد مزدوج** — لا أخطاء تقريب، ولا اختلال صامت.

## بنية المستودع

```
moeen/
├─ docs/              ← الـPRD وقرارات المعمارية (ADR)
│  ├─ PRD-Yemen-*.md
│  └─ adr/
├─ packages/
│  └─ ledger/         ← القلب المالي: Money + دفتر القيد المزدوج (مُختبَر)
├─ apps/
│  ├─ api/            ← الخلفية (NestJS + Prisma)
│  └─ web/            ← الواجهة (Next.js PWA تعمل أوفلاين)
├─ docker-compose.yml ← PostgreSQL + Redis للتطوير
└─ pnpm-workspace.yaml
```

## التشغيل السريع — جرّب المنصة كاملة

المتطلبات: Node ≥ 22، pnpm، Docker.

```bash
pnpm install        # 1) تثبيت الاعتماديات
pnpm setup          # 2) تشغيل PostgreSQL + Redis + تجهيز قاعدة البيانات

# 3) في نافذتين منفصلتين:
pnpm dev:api        #    الخلفية على http://localhost:3000
pnpm dev:web        #    الواجهة على http://localhost:3001

pnpm seed           # 4) تعبئة بيانات تجريبية (تطبع رابط الدخول والمتجر)
```

بعدها افتح **http://localhost:3001**:
- **دخول التاجر:** `+967771234567` / `demo1234` (لوحة التحكم: محفظة، منتجات، طلبات).
- **واجهة المتجر للزبون:** الرابط الذي يطبعه `pnpm seed`.

### اختبارات القلب المالي فقط
```bash
pnpm ledger:test    # 19 اختباراً للقيد المزدوج
```

## القلب المالي (`packages/ledger`)

دفتر أستاذ بالقيد المزدوج يضمن:

- توازن كل قيد (مدين = دائن).
- **لا رصيد سالب** (الحد = 0) — تطبيقاً لقاعدة الـPRD 24.8.5.
- **idempotency** — تكرار الإشعار لا يُرحّل مرتين.
- تجانس العملة، وسجل تدقيق كامل، وفحص سلامة شامل (`assertHealthy`).

مثال:

```ts
import { Ledger, Money } from "@moeen/ledger";

const ledger = new Ledger();
ledger.openAccount({ id: "cash", type: "ASSET", currency: "YER", allowNegative: true });
ledger.openAccount({ id: "wallet:m1", type: "LIABILITY", currency: "YER" });

ledger.post({
  idempotencyKey: "topup:m1:202606",
  description: "شحن محفظة التاجر",
  postings: [
    { accountId: "cash", side: "DEBIT", amount: Money.ofMinor(5000n, "YER") },
    { accountId: "wallet:m1", side: "CREDIT", amount: Money.ofMinor(5000n, "YER") },
  ],
});

ledger.balanceOf("wallet:m1"); // 5000 YER
```

## خريطة الطريق (Roadmap)

- [x] هيكل المستودع + إعدادات الـmonorepo
- [x] القلب المالي: Money + دفتر القيد المزدوج (مُختبَر)
- [x] مخطط بيانات Prisma (نطاق أساسي + دفتر الأستاذ)
- [x] خلفية NestJS (هيكل + Prisma + فلتر أخطاء + health)
- [x] مستودع الدفتر فوق Prisma (قيود داخل معاملة + قفل صفوف + idempotency)
- [x] محفظة التاجر عبر REST (شحن/خصم/رصيد) — مُختبَرة تكاملياً وعبر HTTP
- [x] المصادقة: تسجيل/دخول بالجوال + JWT + حارس + تحقّق مدخلات
- [x] التجار: onboarding ينشئ المستخدم والتاجر وحسابات المحفظة آلياً
- [x] المتاجر والعملاء (إنشاء أساسي)
- [x] الطلبات والشحن: حجز/خصم/تحرير + تسوية COD وإلكتروني + waterfall (ADR 0003)
- [x] محرّك المطابقة (BullMQ) + دورة الإنذار + تحصيل الاشتراكات (ADR 0004)
- [x] catalog (منتجات) + تسعير طلب موثوق من الخادم
- [x] واجهة Next.js PWA: تسجيل/دخول التاجر، لوحة تحكم (محفظة/متاجر/منتجات/طلبات)،
      واجهة متجر عامة مع سلة ودفع، ودعم أوفلاين (service worker + manifest)
- [x] طبقة بوابات الدفع: تحقّق توقيع webhook (HMAC) + منفذ موحّد للمزوّدين (ADR 0005)
- [x] تكامل دورة الحياة: اشتراك يُنشأ مع التسجيل، إدارة التاجر لدورة الطلب
      (بوليصة→تسليم→إلغاء)، تفعيل/تعطيل المنتجات، وتتبّع الزبون لطلبه
- [ ] توصيل المزوّدين الفعليين (MEPS / eSadad-WeNet) — يتطلّب اتفاقاً تجارياً وأسراراً
- [ ] تكامل بوابات الدفع (MEPS / eSadad-WeNet) — بعد onboarding
- [ ] واجهة Next.js PWA (متجر + لوحة تحكم التاجر)

### تشغيل الخلفية محلياً

```bash
docker compose up -d                       # PostgreSQL + Redis
cd apps/api && cp ../../.env.example .env   # اضبط DATABASE_URL
pnpm prisma:deploy                          # تطبيق الـmigrations
pnpm --filter @moeen/api start:dev          # تشغيل الخلفية
```
