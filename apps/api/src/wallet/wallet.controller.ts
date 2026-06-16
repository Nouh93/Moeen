import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { WalletService } from "./wallet.service.js";

interface AmountBody {
  amountMinor: string; // نصّ لتفادي فقدان دقة BigInt في JSON
  reference: string;
}

@Controller("merchants/:merchantId/wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("balance")
  async getBalance(@Param("merchantId") merchantId: string): Promise<{ balanceMinor: string }> {
    const balance = await this.wallet.balance(merchantId);
    return { balanceMinor: balance.toString() };
  }

  @Post("topup")
  async topUp(
    @Param("merchantId") merchantId: string,
    @Body() body: AmountBody,
  ): Promise<{ ok: true }> {
    await this.wallet.topUp(merchantId, BigInt(body.amountMinor), body.reference);
    return { ok: true };
  }

  @Post("charge")
  async charge(
    @Param("merchantId") merchantId: string,
    @Body() body: AmountBody,
  ): Promise<{ ok: true }> {
    await this.wallet.charge(merchantId, BigInt(body.amountMinor), body.reference);
    return { ok: true };
  }
}
