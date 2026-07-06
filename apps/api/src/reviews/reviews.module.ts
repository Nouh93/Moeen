import { Module } from "@nestjs/common";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoresModule } from "../stores/stores.module";
import { StoresService } from "../stores/stores.service";

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

class OpenDisputeDto {
  @IsString()
  @IsNotEmpty({ message: "اشرح مشكلتك باختصار" })
  reason: string;
}

/**
 * التقييمات (القسم 13): بعد التسليم الفعلي فقط — مشترٍ موثّق برمز طلبه.
 * والنزاعات (القسم 25.2): يفتحها العميل من صفحة التتبع.
 */
@Controller()
class ReviewsController {
  constructor(
    private prisma: PrismaService,
    private stores: StoresService,
    private notifications: NotificationsService,
  ) {}

  // ---- عام: تقييم بعد التسليم برمز الطلب ----

  @Post("public/orders/:code/review")
  async create(@Param("code") code: string, @Body() dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!order) throw new NotFoundException("لم نجد طلباً بهذا الرمز");
    if (order.status !== "DELIVERED") {
      throw new BadRequestException("التقييم متاح بعد استلام الطلب فقط");
    }
    const existing = await this.prisma.review.findUnique({
      where: { orderId: order.id },
    });
    if (existing) throw new BadRequestException("قيّمت هذا الطلب سابقاً — شكراً لك!");
    return this.prisma.review.create({
      data: {
        storeId: order.storeId,
        orderId: order.id,
        customerName: order.customerName,
        rating: dto.rating,
        comment: dto.comment,
        imageUrl: dto.imageUrl,
      },
    });
  }

  /** تقييمات المتجر العلنية */
  @Get("public/stores/:slug/reviews")
  async list(@Param("slug") slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException("المتجر غير موجود");
    const [reviews, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { storeId: store.id, status: "VISIBLE" },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.review.aggregate({
        where: { storeId: store.id, status: "VISIBLE" },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      reviews,
      average: agg._avg.rating ?? 0,
      count: agg._count,
    };
  }

  // ---- عام: فتح نزاع من صفحة التتبع (القسم 25.2) ----

  @Post("public/orders/:code/dispute")
  async openDispute(@Param("code") code: string, @Body() dto: OpenDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      include: { store: { include: { owner: true } } },
    });
    if (!order) throw new NotFoundException("لم نجد طلباً بهذا الرمز");
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      throw new BadRequestException(
        "النزاع متاح للطلبات الجارية — للطلبات المستلمة استخدم التقييم أو تواصل مع المتجر",
      );
    }
    const existing = await this.prisma.dispute.findUnique({
      where: { orderId: order.id },
    });
    if (existing) {
      throw new BadRequestException("يوجد نزاع مفتوح على هذا الطلب — نراجعه خلال 48 ساعة");
    }
    const dispute = await this.prisma.dispute.create({
      data: { storeId: order.storeId, orderId: order.id, reason: dto.reason },
    });
    // إشعار التاجر — إذا لم يُحل خلال 48 ساعة تتدخل المنصة (القسم 25.2)
    await this.notifications.enqueue({
      storeId: order.storeId,
      orderId: order.id,
      recipient: order.store.owner.phone,
      template: "DISPUTE_OPENED",
      body: `⚠️ نزاع جديد على الطلب ${order.code}\nمن: ${order.customerName}\nالسبب: ${dto.reason}\nتواصل مع عميلك وحل المشكلة خلال 48 ساعة قبل تدخل المنصة.`,
    });
    return dispute;
  }

  // ---- التاجر: قائمة تقييماته + الرد + التبليغ ----

  @UseGuards(JwtAuthGuard)
  @Get("stores/:storeId/reviews")
  async mine(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    return this.prisma.review.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch("stores/:storeId/reviews/:id/reply")
  async reply(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body() dto: { reply: string },
  ) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    const review = await this.prisma.review.findFirst({ where: { id, storeId } });
    if (!review) throw new NotFoundException("التقييم غير موجود");
    // التاجر يرد علناً ولا يحذف (القسم 13)
    return this.prisma.review.update({ where: { id }, data: { reply: dto.reply } });
  }

  @UseGuards(JwtAuthGuard)
  @Patch("stores/:storeId/reviews/:id/report")
  async report(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    const review = await this.prisma.review.findFirst({ where: { id, storeId } });
    if (!review) throw new NotFoundException("التقييم غير موجود");
    return this.prisma.review.update({ where: { id }, data: { status: "REPORTED" } });
  }
}

@Module({
  imports: [StoresModule, NotificationsModule],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
