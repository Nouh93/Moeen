import { Injectable } from "@nestjs/common";
import { LedgerService } from "../ledger/ledger.service.js";

/**
 * محفظة التاجر فوق دفتر الأستاذ. تطبيق مباشر لقواعد الـPRD 24.8:
 *  - الشحن: نقد (أصل) ← محفظة التاجر (التزام).
 *  - الخصم الذي يتحمّله التاجر: محفظة التاجر ← المستحقّ (التزام).
 *  - منع الرصيد السالب مضمون من طبقة الدفتر (الحد = 0).
 */
@Injectable()
export class WalletService {
  constructor(private readonly ledger: LedgerService) {}

  private walletCode(merchantId: string): string {
    return `wallet:merchant:${merchantId}`;
  }

  /** يضمن وجود حسابات المحفظة الأساسية. يُستدعى عند إنشاء التاجر. */
  async ensureAccounts(merchantId: string): Promise<void> {
    await this.ledger.ensureAccount({
      code: this.walletCode(merchantId),
      type: "LIABILITY",
      merchantId,
    });
    await this.ledger.ensureAccount({ code: "cash", type: "ASSET", allowNegative: true });
    await this.ledger.ensureAccount({ code: "payable:carrier", type: "LIABILITY" });
  }

  async balance(merchantId: string): Promise<bigint> {
    return this.ledger.balanceOf(this.walletCode(merchantId));
  }

  /** شحن المحفظة. `reference` مفتاح فريد للدفعة (idempotency). */
  async topUp(merchantId: string, amountMinor: bigint, reference: string): Promise<void> {
    await this.ensureAccounts(merchantId);
    await this.ledger.post({
      idempotencyKey: `wallet-topup:${reference}`,
      description: `شحن محفظة التاجر ${merchantId}`,
      reference,
      postings: [
        { accountCode: "cash", side: "DEBIT", amountMinor },
        { accountCode: this.walletCode(merchantId), side: "CREDIT", amountMinor },
      ],
    });
  }

  /**
   * خصم رسوم يتحمّلها التاجر (شحن مجاني/إرجاع…) من المحفظة.
   * يُرفض ذرّياً إن لم يكفِ الرصيد (لا رصيد سالب).
   */
  async charge(
    merchantId: string,
    amountMinor: bigint,
    reference: string,
    counterAccount = "payable:carrier",
  ): Promise<void> {
    await this.ensureAccounts(merchantId);
    await this.ledger.post({
      idempotencyKey: `wallet-charge:${reference}`,
      description: `خصم من محفظة التاجر ${merchantId}`,
      reference,
      postings: [
        { accountCode: this.walletCode(merchantId), side: "DEBIT", amountMinor },
        { accountCode: counterAccount, side: "CREDIT", amountMinor },
      ],
    });
  }
}
