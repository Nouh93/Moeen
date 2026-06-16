import { Injectable } from "@nestjs/common";
import { Money } from "@moeen/ledger";

/**
 * التسعير والعمولات. كل النِسَب بنقاط أساس صحيحة (basis points، 1% = 100)
 * وتُحسب عبر Money.multiply (أعداد صحيحة + تقريب صريح) — لا أعداد عائمة.
 *
 * القيم الافتراضية قابلة للضبط لاحقاً عبر الإعدادات/قاعدة البيانات لكل تاجر.
 */
@Injectable()
export class PricingService {
  /** عمولة المنصة على قيمة البيع (2.5%). */
  readonly commissionBps = 250n;
  /** رسوم بوابة الدفع MDR على المعاملة الإلكترونية (2%). */
  readonly mdrBps = 200n;
  /** عمولة تحصيل COD على قيمة الطلب (1%). */
  readonly collectionBps = 100n;

  private bps(amountMinor: bigint, bps: bigint): bigint {
    // half-up عبر Money لضمان عدم فقدان/خلق فلس.
    return Money.ofMinor(amountMinor, "YER").multiply(bps, 10000n).amount;
  }

  commission(subtotalMinor: bigint): bigint {
    return this.bps(subtotalMinor, this.commissionBps);
  }

  mdr(totalMinor: bigint): bigint {
    return this.bps(totalMinor, this.mdrBps);
  }

  collection(subtotalMinor: bigint): bigint {
    return this.bps(subtotalMinor, this.collectionBps);
  }
}
