import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { LedgerModule } from "./ledger/ledger.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [PrismaModule, LedgerModule, WalletModule],
  controllers: [HealthController],
})
export class AppModule {}
