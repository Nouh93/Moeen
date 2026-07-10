import {
  BadRequestException,
  Injectable,
  Module,
  NotFoundException,
} from "@nestjs/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { PLANS, PlanId } from "@moeen/shared";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { StoresModule } from "../stores/stores.module";

class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @Min(1)
  @Max(90)
  percent: number;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

class UpdateOfferDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** العروض التلقائية (القسم 9.3) — ميزة الباقات المدفوعة مثل الكوبونات */
@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
  ) {}

  private async paidPlanOrThrow(storeId: string, ownerId: string) {
    const store = await this.stores.ownedByOrThrow(storeId, ownerId);
    if (!PLANS[store.plan as PlanId].coupons) {
      throw new BadRequestException(
        'العروض التلقائية ميزة باقة "نمو" وما فوق 🚀 رقِّ باقتك من تبويب الاشتراك',
      );
    }
    return store;
  }

  async list(storeId: string, ownerId: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    return this.prisma.offer.findMany({
      where: { storeId },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    storeId: string,
    ownerId: string,
    data: { title: string; percent: number; categoryId?: string | null; endsAt?: string | null },
  ) {
    await this.paidPlanOrThrow(storeId, ownerId);
    if (data.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: data.categoryId, storeId },
      });
      if (!cat) throw new NotFoundException("التصنيف غير موجود");
    }
    return this.prisma.offer.create({
      data: {
        storeId,
        title: data.title,
        percent: data.percent,
        categoryId: data.categoryId || null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  }

  async update(storeId: string, ownerId: string, id: string, data: { active?: boolean }) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const offer = await this.prisma.offer.findFirst({ where: { id, storeId } });
    if (!offer) throw new NotFoundException("العرض غير موجود");
    return this.prisma.offer.update({ where: { id }, data });
  }

  async remove(storeId: string, ownerId: string, id: string) {
    await this.stores.ownedByOrThrow(storeId, ownerId);
    const offer = await this.prisma.offer.findFirst({ where: { id, storeId } });
    if (!offer) throw new NotFoundException("العرض غير موجود");
    return this.prisma.offer.delete({ where: { id } });
  }
}

@UseGuards(JwtAuthGuard)
@Controller("stores/:storeId/offers")
class OffersController {
  constructor(private offers: OffersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    return this.offers.list(storeId, u.sub);
  }

  @Post()
  create(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(storeId, u.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offers.update(storeId, u.sub, id, dto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ) {
    return this.offers.remove(storeId, u.sub, id);
  }
}

@Module({
  imports: [StoresModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
