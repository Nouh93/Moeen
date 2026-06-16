import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, InvalidAmountError } from "./errors.js";
import { Money } from "./money.js";

describe("Money — أساسيات", () => {
  it("يُنشئ من الوحدة الكبرى والصغرى بشكل متطابق (YER scale 0)", () => {
    expect(Money.ofMajor(10000, "YER").equals(Money.ofMinor(10000n, "YER"))).toBe(true);
  });

  it("يطبّق القياس للعملات ذات الكسور (USD scale 2)", () => {
    expect(Money.ofMajor(12.34, "USD").amount).toBe(1234n);
  });

  it("يجمع ويطرح بدقّة", () => {
    const a = Money.ofMinor(9800n, "YER");
    const b = Money.ofMinor(200n, "YER");
    expect(a.add(b).amount).toBe(10000n);
    expect(a.subtract(b).amount).toBe(9600n);
  });

  it("يرفض الخلط بين عملتين", () => {
    expect(() => Money.ofMinor(1n, "YER").add(Money.ofMinor(1n, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("يرفض المبالغ غير الصحيحة في الوحدة الصغرى", () => {
    expect(() => Money.ofMinor(1.5, "YER")).toThrow(InvalidAmountError);
  });
});

describe("Money — الضرب بنِسَب والتقريب", () => {
  it("عمولة 2.5% من 10,000 = 250 (half-up)", () => {
    expect(Money.ofMinor(10000n, "YER").multiply(25n, 1000n).amount).toBe(250n);
  });

  it("يقرّب نصف لأعلى", () => {
    // 1001 * 1/2 = 500.5 → 501
    expect(Money.ofMinor(1001n, "YER").multiply(1n, 2n, "half-up").amount).toBe(501n);
    // down → 500
    expect(Money.ofMinor(1001n, "YER").multiply(1n, 2n, "down").amount).toBe(500n);
  });

  it("يتعامل مع الإشارة السالبة في التقريب بشكل متماثل", () => {
    expect(Money.ofMinor(-1001n, "YER").multiply(1n, 2n, "half-up").amount).toBe(-501n);
  });
});

describe("Money — التوزيع (allocate) بلا فقدان فلس", () => {
  it("يوزّع 10,000 على ثلاثة بالتساوي ويُبقي المجموع", () => {
    const parts = Money.ofMinor(10000n, "YER").allocate([1, 1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([3334n, 3333n, 3333n]);
    const sum = parts.reduce((a, p) => a.add(p), Money.zero("YER"));
    expect(sum.amount).toBe(10000n);
  });

  it("يوزّع بأوزان مختلفة ويُبقي المجموع", () => {
    const parts = Money.ofMinor(10001n, "YER").allocate([70, 20, 10]);
    const sum = parts.reduce((a, p) => a.add(p), Money.zero("YER"));
    expect(sum.amount).toBe(10001n);
  });
});

describe("Money — العرض النصي", () => {
  it("YER بلا كسور", () => {
    expect(Money.ofMinor(9800n, "YER").toString()).toBe("9800 YER");
  });
  it("USD بكسور", () => {
    expect(Money.ofMinor(1234n, "USD").toString()).toBe("12.34 USD");
    expect(Money.ofMinor(-5n, "USD").toString()).toBe("-0.05 USD");
  });
});
