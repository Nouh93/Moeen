import { Injectable } from "@nestjs/common";
import { LedgerService } from "../ledger/ledger.service.js";
import { AccountsService } from "../ledger/accounts.service.js";
import { merchantWallet, PlatformAccounts } from "../ledger/accounts.js";

/**
 * محفظة التاجر فوق دفتر الأستاذ (الرصيد المدفوع مسبقاً).
 *  - الشحن: نقد (أصل) ← محفظة التاجر (التزام).
 *  - الخصم الذي يتحمّله التاجر: محفظة التاجر ← المستحقّ (التزام).
 *  - منع الرصيد السالب مضمون من طبقة الدفتر (الحد = 0).
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  /** يضمن وجود حسابات المحفظة الأساسية. يُستدعى عند إنشاء التاجر. */
  async ensureAccounts(merchantId: string): Promise<void> {
    await this.accounts.ensurePlatform();
    await this.accounts.ensureMerchant(merchantId);
  }

  async balance(merchantId: string): Promise<bigint> {
    return this.ledger.balanceOf(merchantWallet(merchantId));
  }

  /** شحن المحفظة. `reference` مفتاح فريد للدفعة (idempotency). */
  async topUp(merchantId: string, amountMinor: bigint, reference: string): Promise<void> {
    await this.ensureAccounts(merchantId);
    await this.ledger.post({
      idempotencyKey: `wallet-topup:${reference}`,
      description: `شحن محفظة التاجر ${merchantId}`,
      reference,
      postings: [
        { accountCode: PlatformAccounts.CASH, side: "DEBIT", amountMinor },
        { accountCode: merchantWallet(merchantId), side: "CREDIT", amountMinor },
      ],
    });
  }

  /**
   * خصم رسوم يتحمّلها التاجر من المحفظة مباشرةً.
   * يُرفض ذرّياً إن لم يكفِ الرصيد (لا رصيد سالب).
   */
  async charge(
    merchantId: string,
    amountMinor: bigint,
    reference: string,
    counterAccount: string = PlatformAccounts.PAYABLE_CARRIER,
  ): Promise<void> {
    await this.ensureAccounts(merchantId);
    await this.ledger.post({
      idempotencyKey: `wallet-charge:${reference}`,
      description: `خصم من محفظة التاجر ${merchantId}`,
      reference,
      postings: [
        { accountCode: merchantWallet(merchantId), side: "DEBIT", amountMinor },
        { accountCode: counterAccount, side: "CREDIT", amountMinor },
      ],
    });
  }
}
