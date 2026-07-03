import {
  Body,
  Controller,
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
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsBoolean()
  codConfirmation?: boolean;
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

  // ---- واجهة المتجر العامة ----

  @Get("public/stores/:slug")
  publicStore(@Param("slug") slug: string) {
    return this.stores.publicBySlug(slug);
  }
}
