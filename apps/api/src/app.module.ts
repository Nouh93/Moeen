import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { YemenModule } from "./yemen/yemen.module";
import { StoresModule } from "./stores/stores.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    YemenModule,
    StoresModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
