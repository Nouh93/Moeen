import { Injectable } from "@nestjs/common";
import { LedgerService } from "./ledger.service.js";
import {
  merchantHold,
  merchantSettlement,
  merchantWallet,
  PlatformAccounts,
} from "./accounts.js";

/**
 * يضمن وجود حسابات الدفتر (للتاجر وللمنصة). كل العمليات idempotent.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly ledger: LedgerService) {}

  /** حسابات المنصة العامة (تُنشأ مرة واحدة، آمنة للتكرار). */
  async ensurePlatform(): Promise<void> {
    await this.ledger.ensureAccount({ code: PlatformAccounts.CASH, type: "ASSET", allowNegative: true });
    await this.ledger.ensureAccount({
      code: PlatformAccounts.COD_CLEARING,
      type: "ASSET",
      allowNegative: true,
    });
    await this.ledger.ensureAccount({ code: PlatformAccounts.PAYABLE_CARRIER, type: "LIABILITY" });
    await this.ledger.ensureAccount({ code: PlatformAccounts.PAYABLE_ACQUIRER, type: "LIABILITY" });
    await this.ledger.ensureAccount({ code: PlatformAccounts.PAYABLE_PAYOUTS, type: "LIABILITY" });
    await this.ledger.ensureAccount({ code: PlatformAccounts.REVENUE_COMMISSION, type: "REVENUE" });
    await this.ledger.ensureAccount({ code: PlatformAccounts.REVENUE_COLLECTION, type: "REVENUE" });
    await this.ledger.ensureAccount({
      code: PlatformAccounts.REVENUE_SUBSCRIPTION,
      type: "REVENUE",
    });
    await this.ledger.ensureAccount({ code: PlatformAccounts.EXPENSE_MDR, type: "EXPENSE" });
  }

  /** حسابات تاجر بعينه (محفظة + تسوية + حجز). */
  async ensureMerchant(merchantId: string): Promise<void> {
    await this.ledger.ensureAccount({
      code: merchantWallet(merchantId),
      type: "LIABILITY",
      merchantId,
    });
    await this.ledger.ensureAccount({
      code: merchantSettlement(merchantId),
      type: "LIABILITY",
      merchantId,
    });
    await this.ledger.ensureAccount({
      code: merchantHold(merchantId),
      type: "LIABILITY",
      merchantId,
    });
  }
}
