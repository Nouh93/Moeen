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
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CURRENCIES } from "@moeen/shared";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { StoresService } from "./stores.service";

class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsIn(CURRENCIES as unknown as string[])
  currency?: string;

  @IsOptional()
  @IsInt()
  governorateId?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;
}

class UpdateStoreDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShippingAbove?: number | null;

  @IsOptional()
  @IsBoolean()
  codConfirmation?: boolean;
}

class UpsertShippingRateDto {
  @IsInt()
  governorateId: number;

  @IsNumber()
  @Min(0)
  fee: number;

  @IsOptional()
  @IsString()
  etaText?: string;
}

@Controller()
export class StoresController {
  constructor(private stores: StoresService) {}

  // ---- نقاط نهاية التاجر (مصادقة) ----

  @UseGuards(JwtAuthGuard)
  @Post("stores")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.stores.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("stores/mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.stores.mine(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("stores/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.stores.update(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("stores/:id/stats")
  stats(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.stores.stats(id, user.sub);
  }

  // ---- أسعار الشحن ----

  @UseGuards(JwtAuthGuard)
  @Get("stores/:id/shipping-rates")
  listRates(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.stores.listShippingRates(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post("stores/:id/shipping-rates")
  upsertRate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpsertShippingRateDto,
  ) {
    return this.stores.upsertShippingRate(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("stores/:id/shipping-rates/:rateId")
  deleteRate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("rateId") rateId: string,
  ) {
    return this.stores.deleteShippingRate(id, user.sub, rateId);
  }

  // ---- واجهة المتجر العامة ----

  @Get("public/stores/:slug")
  publicStore(@Param("slug") slug: string) {
    return this.stores.publicBySlug(slug);
  }
}
