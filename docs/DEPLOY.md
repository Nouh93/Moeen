# نشر مُعين (Deployment)

ثلاث طرق حسب حاجتك. الأبسط أولاً.

---

## الطريقة 1 — خادم واحد (VPS) بأمر واحد ✅ الأسهل

على أي خادم فيه Docker (مثل DigitalOcean/Hetzner/Contabo):

```bash
git clone <repo> && cd Moeen
export JWT_SECRET="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"
export PUBLIC_API_URL="http://<عنوان-الخادم>:3000"   # أو دومين الـAPI

docker compose -f docker-compose.prod.yml up -d --build
```

يشغّل هذا: PostgreSQL + Redis + الخلفية (مع تطبيق الهجرات تلقائياً) + الواجهة.
- الواجهة: `http://<الخادم>:3001`
- الخلفية: `http://<الخادم>:3000`

> للإنتاج الحقيقي: ضع **Nginx/Caddy** أمامها لشهادة HTTPS ودومين، ووجّه
> `api.example.com → :3000` و`example.com → :3001`، واضبط `PUBLIC_API_URL`
> على `https://api.example.com`.

---

## الطريقة 2 — استضافة مُدارة (بلا خادم تديره)

**الخلفية + قاعدة + Redis على [Railway](https://railway.app) أو [Render](https://render.com):**
1. أنشئ خدمة من `apps/api/Dockerfile`.
2. أضف PostgreSQL وRedis كإضافات (Plugins/Add-ons).
3. اضبط المتغيّرات: `DATABASE_URL`، `REDIS_URL`، `JWT_SECRET`.
   (الهجرات تُطبَّق تلقائياً عند الإقلاع.)

**الواجهة على [Vercel](https://vercel.com):**
1. استورد المستودع، واضبط Root Directory = `apps/web`.
2. أضف المتغيّر `NEXT_PUBLIC_API_URL` = رابط الخلفية المنشورة.
3. انشر.

---

## الطريقة 3 — تطوير محلي

راجع `README.md` (قسم «التشغيل السريع»): `pnpm setup` ثم `pnpm dev:api` و`pnpm dev:web`.

---

## المتغيّرات المطلوبة

| المتغيّر | الوصف |
|---|---|
| `DATABASE_URL` | اتصال PostgreSQL |
| `REDIS_URL` | اتصال Redis (للطوابير) |
| `JWT_SECRET` | سرّ توقيع التوكنات — **غيّره في الإنتاج** |
| `NEXT_PUBLIC_API_URL` | رابط الخلفية كما يراه المتصفح (للواجهة) |
| `*_WEBHOOK_SECRET` | أسرار توقيع مزوّدي الدفع (عند التوصيل — راجع ADR 0005) |

## أول مشرف بعد النشر

افتح الواجهة على `/admin` ← «أنشئ أول مشرف» (يعمل مرة واحدة فقط).

## ملاحظات

- الخلفية تُطبّق هجرات Prisma تلقائياً عند الإقلاع (`prisma migrate deploy`).
- بلا `REDIS_URL` يعمل تحصيل الدفعات بمعالجة متزامنة بدل الطابور (راجع ADR 0004).
- النسخ الاحتياطي: احرص على نسخ مجلّد بيانات PostgreSQL (`pgdata`) دورياً.
