import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module.js";
import { MerchantsService } from "./merchants.service.js";
import { MerchantsController } from "./merchants.controller.js";

@Module({
  imports: [WalletModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
