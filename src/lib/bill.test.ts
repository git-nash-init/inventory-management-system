import { describe, expect, it } from "vitest";
import { billNumber, calcBill, isValidMobile, monthStart, parseNumber } from "./bill";

describe("calcBill", () => {
  it("adds no GST when no percent is given", () => {
    const r = calcBill([{ qty: 20, price: 50 }], null);
    expect(r).toEqual({ amounts: [1000], subtotal: 1000, gstAmount: 0, total: 1000 });
  });
  it("treats 0 percent like no GST", () => {
    expect(calcBill([{ qty: 1, price: 100 }], 0).total).toBe(100);
  });
  it("adds GST once on the subtotal", () => {
    const r = calcBill([{ qty: 5, price: 50 }], 5);
    expect(r.subtotal).toBe(250);
    expect(r.gstAmount).toBe(12.5);
    expect(r.total).toBe(262.5);
  });
  it("rounds each line and the GST to paise", () => {
    const r = calcBill(
      [
        { qty: 0.333, price: 10 },
        { qty: 3, price: 9.99 },
      ],
      18,
    );
    expect(r.amounts).toEqual([3.33, 29.97]);
    expect(r.subtotal).toBe(33.3);
    expect(r.gstAmount).toBe(5.99);
    expect(r.total).toBe(39.29);
  });
  it("is zero for an empty bill", () => {
    expect(calcBill([], 18).total).toBe(0);
  });
});

describe("helpers", () => {
  it("reads numbers typed by people", () => {
    expect(parseNumber("1,200.50")).toBe(1200.5);
    expect(parseNumber(" 12 ")).toBe(12);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
  it("numbers bills", () => {
    expect(billNumber(7)).toBe("BILL-0007");
    expect(billNumber(12345)).toBe("BILL-12345");
  });
  it("checks mobile numbers", () => {
    expect(isValidMobile("98765 43210")).toBe(true);
    expect(isValidMobile("+91 98765 43210")).toBe(true);
    expect(isValidMobile("12345")).toBe(false);
  });
  it("finds the first day of a month", () => {
    const today = new Date(2026, 10, 17);
    expect(monthStart(0, today)).toBe("2026-11-01");
    expect(monthStart(-1, today)).toBe("2026-10-01");
    expect(monthStart(-11, today)).toBe("2025-12-01");
  });
});
