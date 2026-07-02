#!/usr/bin/env bash
# إعداد بيئة مُعين المحلية بأمر واحد: PostgreSQL + Redis + قاعدة البيانات + ملفات البيئة.
set -e
cd "$(dirname "$0")/.."

echo "▶ تشغيل PostgreSQL و Redis (Docker)…"
docker compose up -d

# ملفات البيئة (تُنشأ مرة واحدة)
[ -f apps/api/.env ] || cp .env.example apps/api/.env
[ -f apps/web/.env.local ] || echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > apps/web/.env.local

echo "▶ انتظار جاهزية قاعدة البيانات…"
sleep 5

echo "▶ تطبيق مخطط قاعدة البيانات…"
pnpm --filter @moeen/api prisma:deploy

echo ""
echo "✓ تم الإعداد. شغّل في نافذتين:"
echo "    pnpm dev:api     (الخلفية على :3000)"
echo "    pnpm dev:web     (الواجهة على :3001)"
echo "  ثم لتعبئة بيانات تجريبية:  pnpm seed"
