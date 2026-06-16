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
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post("merchants/:merchantId/stores")
  create(@Param("merchantId") merchantId: string, @Body() dto: CreateStoreDto) {
    return this.stores.create(merchantId, dto);
  }

  @Get("stores/:id")
  findById(@Param("id") id: string) {
    return this.stores.findById(id);
  }
}
