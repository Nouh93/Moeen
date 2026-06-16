import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { ShippingService } from "./shipping.service.js";
import { ShippingController } from "./shipping.controller.js";

@Module({
  imports: [LedgerModule, OrdersModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
