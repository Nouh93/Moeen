import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StoresService } from "./stores.service.js";

class CreateStoreDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  merchantPaysShipping?: boolean;
}

@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post("merchants/:merchantId/stores")
  @UseGuards(JwtAuthGuard)
  create(@Param("merchantId") merchantId: string, @Body() dto: CreateStoreDto) {
    return this.stores.create(merchantId, dto);
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
