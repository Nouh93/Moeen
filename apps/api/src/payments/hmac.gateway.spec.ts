import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { HmacGateway } from "./hmac.gateway.js";

const SECRET = "test-secret";
const sign = (raw: Buffer) => createHmac("sha256", SECRET).update(raw).digest("hex");

describe("HmacGateway", () => {
  it("غير مُهيَّأ بلا سرّ ويرفض كل التواقيع", () => {
    const g = new HmacGateway("AGGREGATOR", undefined);
    expect(g.configured).toBe(false);
    expect(g.verifySignature(Buffer.from("{}"), "anything")).toBe(false);
  });

  it("يقبل التوقيع الصحيح ويرفض الخاطئ/المفقود", () => {
    const g = new HmacGateway("AGGREGATOR", SECRET);
    const raw = Buffer.from(JSON.stringify({ externalRef: "x", amountMinor: "3000" }));
    expect(g.verifySignature(raw, sign(raw))).toBe(true);
    expect(g.verifySignature(raw, "deadbeef")).toBe(false);
    expect(g.verifySignature(raw, undefined)).toBe(false);
    // تغيير الجسم يُبطل التوقيع.
    expect(g.verifySignature(Buffer.from('{"externalRef":"y"}'), sign(raw))).toBe(false);
  });

  it("يُطبّع الحمولة إلى حدث دفع موحّد", () => {
    const g = new HmacGateway("MEPS_SETTLEMENT", SECRET);
    const event = g.normalize({ externalRef: "meps-9", amountMinor: "5000", reference: "MOEEN-m-202606" });
    expect(event).toMatchObject({
      externalRef: "meps-9",
      source: "MEPS_SETTLEMENT",
      amountMinor: 5000n,
      reference: "MOEEN-m-202606",
    });
  });

  it("يرفض الحمولة الناقصة", () => {
    const g = new HmacGateway("AGGREGATOR", SECRET);
    expect(() => g.normalize({ amountMinor: "1" })).toThrow(BadRequestException);
    expect(() => g.normalize({ externalRef: "a", amountMinor: "abc" })).toThrow(BadRequestException);
  });
});
