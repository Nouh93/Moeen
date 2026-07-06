import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { YemenModule } from "./yemen/yemen.module";
import { StoresModule } from "./stores/stores.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { CategoriesModule } from "./categories/categories.module";
import { CouponsModule } from "./coupons/coupons.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { UploadsModule } from "./uploads/uploads.module";
import { BillingModule } from "./billing/billing.module";

@Module({
  imports: [
    // حدود معدل الطلبات — حماية OTP والواجهات العامة (القسم 18.1)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    YemenModule,
    StoresModule,
    ProductsModule,
    OrdersModule,
    CategoriesModule,
    CouponsModule,
    NotificationsModule,
    UploadsModule,
    BillingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
