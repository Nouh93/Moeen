import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service.js";
import { AccountsService } from "./accounts.service.js";

@Module({
  providers: [LedgerService, AccountsService],
  exports: [LedgerService, AccountsService],
})
export class LedgerModule {}
