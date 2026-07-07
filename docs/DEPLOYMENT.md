# دليل نشر مُعين للإنتاج 🚀

من صفر إلى منصة تعمل على الإنترنت — الوقت التقديري: **ساعتان**.

## 1. المتطلبات

| البند | المواصفة | ملاحظة |
|---|---|---|
| سيرفر | VPS بذاكرة 4GB+ (أوبنتو 22+) في الخليج | أقرب نقطة موثوقة لليمن (القسم 22.3.1) — **للإطلاق من قطر انظر `LAUNCH-QATAR.md`** (GCP الدوحة / Azure قطر) |
| دومين | مثل `moeen.ye` أو `.com` | وجّهه عبر **Cloudflare** (CDN + حماية) |
| Docker | `curl -fsSL https://get.docker.com | sh` | |

## 2. الإعداد على السيرفر

```bash
git clone <رابط المستودع> moeen && cd moeen

# الأسرار — كلها إلزامية والإقلاع يفشل عمداً بدونها
cp .env.production.example .env
openssl rand -hex 24   # → DB_PASSWORD
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → PAYMENTS_WEBHOOK_SECRET
nano .env              # واملأ WEB_URL و API_PUBLIC_URL

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx ts-node -T prisma/seed.ts
curl http://127.0.0.1:4000/health   # {"ok":true,...}
```

## 3. الـ Reverse Proxy (Caddy — أسهل خيار مع HTTPS تلقائي)

```bash
apt install -y caddy
cat > /etc/caddy/Caddyfile <<'EOF'
moeen.ye {
    reverse_proxy 127.0.0.1:3000
}
api.moeen.ye {
    reverse_proxy 127.0.0.1:4000
}
EOF
systemctl reload caddy
```

في Cloudflare: سجلان A لـ `moeen.ye` و`api.moeen.ye` → IP السيرفر (السحابة البرتقالية مفعّلة).

## 4. بعد النشر مباشرة

1. **حساب المدير**: مرّر رقمك عند البذر: `ADMIN_PHONE=+9677XXXXXXXX` (الافتراضي `700000001`) — لوحة الإدارة على `/admin`.
2. **واتساب**: وقّع مع مزوّد BSP (مثل 360dialog / Twilio) واستبدل مزوّد التطوير في
   `apps/api/src/notifications/notifications.service.ts` (دالة `deliver` — موضع TODO واحد).
   حتى يتم ذلك: الرسائل تُسجَّل في سجل الحاوية ولا تُرسَل فعلياً.
3. **الدفع**: أعطِ المُجمِّع/البنك رابط `https://api.moeen.ye/webhooks/payments/aggregator`
   مع الهيدر `x-moeen-webhook-secret` = قيمة `PAYMENTS_WEBHOOK_SECRET`.
4. **مراقبة**: راقب `https://api.moeen.ye/health` بخدمة مثل UptimeRobot (مجانية) من عدة مواقع.

## 5. العمليات اليومية

```bash
# تحديث المنصة
git pull && docker compose -f docker-compose.prod.yml up -d --build

# السجلات
docker compose -f docker-compose.prod.yml logs -f api

# النسخ الاحتياطي: يومي 3:30 فجراً تلقائياً في ./backups (آخر 14 نسخة)
# انسخها خارج السيرفر دورياً (القسم 22.3.3):
rsync -a backups/ user@offsite:/moeen-backups/

# استعادة نسخة
gunzip -c backups/moeen-YYYYMMDD-HHMM.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U moeen moeen
```

## 6. قائمة فحص الإطلاق التجريبي

- [ ] `/health` يرد `ok` من الدومين العام
- [ ] إنشاء متجر حقيقي + طلب COD كامل من جوال بشبكة يمنية
- [ ] webhook دفع تجريبي بالسر الإنتاجي يفعّل اشتراكاً
- [ ] النسخة الاحتياطية الأولى موجودة في `./backups` واستُعيدت تجريبياً
- [ ] مزوّد واتساب موصول ورسالة تأكيد طلب وصلت فعلياً
- [ ] حساب المدير يفتح `/admin` وحساب تاجر عادي يُرفض

## المتبقي خارج هذا الدليل
اتفاقات eSadad/WeNet وMEPS (تجارية)، الترخيص القانوني، فريق الدعم — انظر القسم 24.7 من الملحق.
