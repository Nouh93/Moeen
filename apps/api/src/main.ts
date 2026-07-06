import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { mkdirSync } from "fs";
import { AppModule } from "./app.module";
import { UPLOADS_DIR } from "./uploads/uploads.module";

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "moeen-dev-secret") {
    missing.push("JWT_SECRET");
  }
  if (
    !process.env.PAYMENTS_WEBHOOK_SECRET ||
    process.env.PAYMENTS_WEBHOOK_SECRET === "dev-webhook-secret"
  ) {
    missing.push("PAYMENTS_WEBHOOK_SECRET");
  }
  if (!process.env.WEB_URL) missing.push("WEB_URL");
  if (missing.length) {
    // نرفض الإقلاع بأسرار تطوير في الإنتاج — حماية من أخطر خطأ نشر
    throw new Error(`أسرار إنتاج ناقصة أو افتراضية: ${missing.join(", ")}`);
  }
}

async function bootstrap() {
  assertProductionSecrets();
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  // خدمة الصور المرفوعة (في الإنتاج: S3 + CDN — القسم 17.1)
  app.useStaticAssets(UPLOADS_DIR, {
    prefix: "/uploads/",
    maxAge: "30d",
    immutable: true,
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  console.log(`🇾🇪 مُعين API يعمل على http://localhost:${port}`);
}
bootstrap();
