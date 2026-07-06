import { Module } from "@nestjs/common";
import { CartsModule } from "../carts/carts.module";
import { CouponsModule } from "../coupons/coupons.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { StoresModule } from "../stores/stores.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [StoresModule, CouponsModule, NotificationsModule, CartsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
