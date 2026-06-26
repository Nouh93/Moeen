import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsNumberString, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { PayoutsService } from "./payouts.service.js";

class RequestPayoutDto {
  @IsNumberString() amountMinor!: string;
}
class MarkPaidDto {
  @IsOptional() @IsString() method?: string;
}

@Controller()
export class PayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly ownership: OwnershipService,
  ) {}

  /** التاجر يطلب سحب مستحقاته. */
  @Post("merchants/:merchantId/payouts")
  @UseGuards(JwtAuthGuard)
  async request(
    @Param("merchantId") merchantId: string,
    @Body() dto: RequestPayoutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    return this.payouts.request(merchantId, BigInt(dto.amountMinor));
  }

  @Get("merchants/:merchantId/payouts")
  @UseGuards(JwtAuthGuard)
  async list(@Param("merchantId") merchantId: string, @CurrentUser() user: JwtPayload) {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    return this.payouts.listByMerchant(merchantId);
  }

  /** المشرف: قائمة طلبات السحب المعلّقة. */
  @Get("admin/payouts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  pending() {
    return this.payouts.listPending();
  }

  /** المشرف: تأكيد صرف طلب سحب. */
  @Post("admin/payouts/:id/paid")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "STAFF")
  markPaid(@Param("id") id: string, @Body() dto: MarkPaidDto) {
    return this.payouts.markPaid(id, dto.method);
  }
}
