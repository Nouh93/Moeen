import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { JwtPayload } from "../auth/auth.service.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { WalletService } from "./wallet.service.js";

interface AmountBody {
  amountMinor: string; // نصّ لتفادي فقدان دقة BigInt في JSON
  reference: string;
}

@Controller("merchants/:merchantId/wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get("balance")
  async getBalance(
    @Param("merchantId") merchantId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ balanceMinor: string }> {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    const balance = await this.wallet.balance(merchantId);
    return { balanceMinor: balance.toString() };
  }

  @Post("topup")
  async topUp(
    @Param("merchantId") merchantId: string,
    @Body() body: AmountBody,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ ok: true }> {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    await this.wallet.topUp(merchantId, BigInt(body.amountMinor), body.reference);
    return { ok: true };
  }

  @Post("charge")
  async charge(
    @Param("merchantId") merchantId: string,
    @Body() body: AmountBody,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ ok: true }> {
    await this.ownership.assertOwnsMerchant(user, merchantId);
    await this.wallet.charge(merchantId, BigInt(body.amountMinor), body.reference);
    return { ok: true };
  }
}
