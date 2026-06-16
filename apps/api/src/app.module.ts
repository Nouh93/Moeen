import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { LedgerModule } from "./ledger/ledger.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { MerchantsModule } from "./merchants/merchants.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [PrismaModule, AuthModule, LedgerModule, WalletModule, MerchantsModule],
  controllers: [HealthController],
})
export class AppModule {}
