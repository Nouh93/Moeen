import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { mkdirSync } from "fs";
import { AppModule } from "./app.module";
import { UPLOADS_DIR } from "./uploads/uploads.module";

async function bootstrap() {
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
