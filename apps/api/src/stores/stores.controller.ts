import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { StoresService } from "./stores.service.js";

class CreateStoreDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  merchantPaysShipping?: boolean;
}

class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  merchantPaysShipping?: boolean;
}

@Controller()
export class StoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post("merchants/:merchantId/stores")
  @UseGuards(JwtAuthGuard)
  async create(
    @Param("merchantId") merchantId: string,
    @Body() dto: CreateStoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    return this.stores.create(merchantId, dto);
  }

  /** تعديل إعدادات المتجر (الاسم/من يتحمّل الشحن). */
  @Patch("stores/:id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ownership.assertOwnsStore(user, id);
    return this.stores.update(id, dto);
  }

  /** صفحة المتجر عامة (واجهة الزبون). */
  @Get("stores/:id")
  findById(@Param("id") id: string) {
    return this.stores.findById(id);
  }

  /** قائمة متاجر تاجر — عامة. */
  @Get("merchants/:merchantId/stores")
  listByMerchant(@Param("merchantId") merchantId: string) {
    return this.stores.listByMerchant(merchantId);
  }
}
