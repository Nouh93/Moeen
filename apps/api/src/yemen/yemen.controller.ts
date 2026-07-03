import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
