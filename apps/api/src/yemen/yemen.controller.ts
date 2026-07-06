import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** فحص الصحة للمراقبة والـ load balancer */
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get("health")
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, ts: new Date().toISOString() };
  }
}

/** التقسيم الإداري اليمني — عام بلا مصادقة (يغذي نموذج العنوان، القسم 23.2 بالملحق) */
@Controller("public/yemen")
export class YemenController {
  constructor(private prisma: PrismaService) {}

  @Get("governorates")
  governorates() {
    return this.prisma.governorate.findMany({
      include: { districts: { orderBy: { nameAr: "asc" } } },
      orderBy: { id: "asc" },
    });
  }
}
