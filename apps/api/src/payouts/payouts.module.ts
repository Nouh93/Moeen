import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { PayoutsService } from "./payouts.service.js";
import { PayoutsController } from "./payouts.controller.js";

@Module({
  imports: [LedgerModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
