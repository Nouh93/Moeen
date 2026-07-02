# صورة إنتاج خلفية مُعين (NestJS) — بناء متعدّد المراحل داخل monorepo (pnpm).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
# OpenSSL مطلوب لـ Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- تثبيت الاعتماديات (طبقة قابلة للتخزين المؤقت) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ledger/package.json packages/ledger/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- البناء ----
FROM base AS build
COPY --from=deps /app /app
COPY packages/ledger packages/ledger
COPY apps/api apps/api
RUN pnpm --filter @moeen/ledger build \
 && pnpm --filter @moeen/api exec prisma generate \
 && pnpm --filter @moeen/api build

# ---- التشغيل ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3000
# طبّق الهجرات ثم شغّل الخادم
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
