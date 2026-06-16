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
│  └─ api/            ← الخلفية (Prisma schema حالياً؛ NestJS قادم)
├─ docker-compose.yml ← PostgreSQL + Redis للتطوير
└─ pnpm-workspace.yaml
```

## التشغيل السريع

المتطلبات: Node ≥ 22، pnpm، Docker.

```bash
pnpm install                 # تثبيت الاعتماديات
cp .env.example .env          # إعداد البيئة
docker compose up -d          # PostgreSQL + Redis

pnpm ledger:test              # تشغيل اختبارات القلب المالي (19 اختباراً)
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
- [ ] خلفية NestJS: وحدات auth / merchants / catalog / orders
- [ ] مستودع الدفتر فوق Prisma (كتابة القيود داخل معاملة)
- [ ] محرّك المطابقة (BullMQ) + دورة الإنذار
- [ ] تكامل بوابات الدفع (MEPS / eSadad-WeNet) — بعد onboarding
- [ ] واجهة Next.js PWA (متجر + لوحة تحكم التاجر)
