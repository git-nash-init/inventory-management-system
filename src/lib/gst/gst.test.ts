import { describe, expect, it } from "vitest";
import { calcInvoice, calcLine, gstinCheckChar, hsnSummary, supplyType, validateGstin } from "./index";

function makeGstin(first14: string) {
  return first14 + gstinCheckChar(first14);
}

describe("supply type", () => {
  it("is intra-state when seller and place of supply match", () => {
    expect(supplyType("27", "27")).toBe("intra");
    expect(supplyType("27", "29")).toBe("inter");
  });
});

describe("calcLine", () => {
  it("splits 18% into CGST 9 + SGST 9 for intra-state", () => {
    const r = calcLine({ qty: 2, rate: 500, gstRate: 18 }, "intra");
    expect(r.taxable).toBe(1000);
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
    expect(r.igst).toBe(0);
    expect(r.total).toBe(1180);
  });
  it("charges IGST for inter-state", () => {
    const r = calcLine({ qty: 1, rate: 1000, gstRate: 12 }, "inter");
    expect(r.igst).toBe(120);
    expect(r.cgst + r.sgst).toBe(0);
  });
  it("applies percent then flat discount before tax", () => {
    const r = calcLine({ qty: 1, rate: 1000, discountPct: 10, discountAmt: 50, gstRate: 18 }, "intra");
    expect(r.discount).toBe(150);
    expect(r.taxable).toBe(850);
    expect(r.total).toBe(1003);
  });
  it("backs tax out of a tax-inclusive price", () => {
    const r = calcLine({ qty: 1, rate: 1180, gstRate: 18, priceIncludesTax: true }, "intra");
    expect(r.taxable).toBe(1000);
    expect(r.total).toBe(1180);
  });
  it("charges no tax on a bill of supply", () => {
    const r = calcLine({ qty: 1, rate: 1000, gstRate: 18 }, "intra", { noTax: true });
    expect(r.total).toBe(1000);
    expect(r.cgst + r.sgst + r.igst).toBe(0);
  });
  it("does not let a discount exceed the gross", () => {
    const r = calcLine({ qty: 1, rate: 100, discountAmt: 500, gstRate: 18 }, "intra");
    expect(r.taxable).toBe(0);
  });
});

describe("calcInvoice", () => {
  it("rounds the grand total to the nearest rupee and reports the round-off", () => {
    const t = calcInvoice([{ qty: 1, rate: 99.99, gstRate: 18 }], "intra");
    expect(t.taxable).toBe(99.99);
    expect(t.cgst + t.sgst).toBeCloseTo(18, 2);
    expect(Number.isInteger(t.grandTotal)).toBe(true);
    expect(t.grandTotal).toBe(118);
    expect(t.roundOff).toBeCloseTo(118 - (99.99 + t.cgst + t.sgst), 2);
  });
  it("adds TCS on the tax-inclusive value", () => {
    const t = calcInvoice([{ qty: 1, rate: 1000, gstRate: 18 }], "inter", { tcsPct: 1, roundOff: false });
    expect(t.tcs).toBe(11.8);
    expect(t.grandTotal).toBe(1191.8);
  });
  it("sums multiple lines without float drift", () => {
    const lines = Array.from({ length: 10 }, () => ({ qty: 1, rate: 0.1, gstRate: 0 }));
    expect(calcInvoice(lines, "intra", { roundOff: false }).taxable).toBe(1);
  });
});

describe("hsnSummary", () => {
  it("groups lines by HSN and rate", () => {
    const t = calcInvoice(
      [
        { qty: 1, rate: 100, gstRate: 18, hsn: "8517" },
        { qty: 2, rate: 100, gstRate: 18, hsn: "8517" },
        { qty: 1, rate: 100, gstRate: 5, hsn: "1006" },
      ],
      "intra",
      { roundOff: false },
    );
    const rows = hsnSummary(t.lines);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.hsn === "8517")?.taxable).toBe(300);
  });
});

describe("validateGstin", () => {
  it("accepts a well-formed GSTIN with a correct check character", () => {
    const g = makeGstin("27ABCDE1234F1Z");
    const r = validateGstin(g);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.stateCode).toBe("27");
  });
  it("rejects wrong length with the exact message", () => {
    const r = validateGstin("27ABC");
    expect(r).toEqual({ valid: false, reason: "GSTIN must be 15 characters like 27ABCDE1234F1Z5" });
  });
  it("rejects a bad check character", () => {
    const good = makeGstin("27ABCDE1234F1Z");
    const bad = good.slice(0, 14) + (good[14] === "A" ? "B" : "A");
    expect(validateGstin(bad).valid).toBe(false);
  });
  it("rejects an unknown state code", () => {
    const g = makeGstin("25ABCDE1234F1Z");
    expect(validateGstin(g).valid).toBe(false);
  });
});
