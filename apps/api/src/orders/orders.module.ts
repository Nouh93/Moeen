import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { OrdersService } from "./orders.service.js";
import { OrdersController } from "./orders.controller.js";
import { TrackingController } from "./tracking.controller.js";
import { PricingService } from "./pricing.js";

@Module({
  imports: [LedgerModule],
  controllers: [OrdersController, TrackingController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService, PricingService],
})
export class OrdersModule {}
