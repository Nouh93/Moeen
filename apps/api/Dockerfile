# مُعين API — صورة إنتاجية
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @moeen/api --filter @moeen/shared
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @moeen/shared build \
 && cd apps/api && npx prisma generate && npx tsc

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json /app/apps/api/tsconfig.json ./apps/api/
WORKDIR /app/apps/api
EXPOSE 4000
# تُطبَّق الهجرات عند الإقلاع ثم يبدأ الخادم
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
