import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CouponsService } from "./coupons.service";

class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsIn(["PERCENT", "FIXED"])
  type: "PERCENT" | "FIXED";

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number;
}

@Controller()
export class CouponsController {
  constructor(
    private coupons: CouponsService,
    private prisma: PrismaService,
  ) {}

  // ---- التاجر ----

  @UseGuards(JwtAuthGuard)
  @Get("stores/:storeId/coupons")
  list(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    return this.coupons.list(storeId, u.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post("stores/:storeId/coupons")
  create(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.coupons.create(storeId, u.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("stores/:storeId/coupons/:id/toggle")
  toggle(
    @CurrentUser() u: AuthUser,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ) {
    return this.coupons.toggle(storeId, u.sub, id);
  }

  // ---- عام: معاينة الكوبون في السلة ----

  @Post("public/stores/:slug/coupons/validate")
  async validate(@Param("slug") slug: string, @Body() dto: ValidateCouponDto) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store || store.status !== "ACTIVE") {
      throw new NotFoundException("المتجر غير موجود");
    }
    const { coupon, discount } = await this.coupons.validate(
      store.id,
      dto.code,
      new Prisma.Decimal(dto.subtotal),
    );
    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
    };
  }
}
