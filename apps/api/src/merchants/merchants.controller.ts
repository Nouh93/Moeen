import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { MerchantsService } from "./merchants.service.js";
import { OnboardMerchantDto } from "./dto.js";

@Controller("merchants")
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  /** تسجيل تاجر جديد — عام (بلا توكن). */
  @Post("onboard")
  onboard(@Body() dto: OnboardMerchantDto) {
    return this.merchants.onboard(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.merchants.list();
  }

  /** التاجر المرتبط بالمستخدم الحالي (يجب أن يسبق :id). */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.merchants.findByUserId(user.sub);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findById(@Param("id") id: string) {
    return this.merchants.findById(id);
  }
}
