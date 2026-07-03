import { Module } from "@nestjs/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { StoresModule } from "../stores/stores.module";
import { StoresService } from "../stores/stores.service";

class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

/** تصنيفات المنتجات (القسم 5.4) */
@UseGuards(JwtAuthGuard)
@Controller("stores/:storeId/categories")
class CategoriesController {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
  ) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    return this.prisma.category.findMany({
      where: { storeId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    return this.prisma.category.upsert({
      where: { storeId_name: { storeId, name: dto.name.trim() } },
      create: { storeId, name: dto.name.trim() },
      update: {},
    });
  }

  @Delete(":id")
  async remove(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    const category = await this.prisma.category.findFirst({
      where: { id, storeId },
    });
    if (!category) throw new NotFoundException("التصنيف غير موجود");
    // فك ربط المنتجات ثم الحذف
    await this.prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    return this.prisma.category.delete({ where: { id } });
  }
}

@Module({
  imports: [StoresModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
