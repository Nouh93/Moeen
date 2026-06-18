import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { MerchantsService } from "./merchants.service.js";
import { MerchantsController } from "./merchants.controller.js";

@Module({
  imports: [WalletModule, BillingModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
