import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { LedgerModule } from "./ledger/ledger.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { MerchantsModule } from "./merchants/merchants.module.js";
import { StoresModule } from "./stores/stores.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { ShippingModule } from "./shipping/shipping.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LedgerModule,
    WalletModule,
    MerchantsModule,
    StoresModule,
    CustomersModule,
    CatalogModule,
    OrdersModule,
    ShippingModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
