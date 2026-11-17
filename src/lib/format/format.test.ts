import { describe, expect, it } from "vitest";
import { amountInWords, formatAmount, formatDate, formatINR, formatMonth, round2 } from "./index";

describe("INR formatting", () => {
  it("groups in the Indian system", () => {
    expect(formatAmount(12345678)).toBe("1,23,45,678.00");
    expect(formatINR(1234.5)).toContain("1,234.50");
    expect(formatINR(1234.5)).toContain("₹");
  });
  it("rounds to two places without float drift", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("amount in words", () => {
  it("handles lakh and crore", () => {
    expect(amountInWords(123456)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only");
    expect(amountInWords(12345678)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });
  it("handles paise and zero", () => {
    expect(amountInWords(100.5)).toBe("Rupees One Hundred and Fifty Paise Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });
});

describe("dates", () => {
  it("formats DD-MM-YYYY from a Date", () => {
    expect(formatDate(new Date(2025, 10, 8))).toBe("08-11-2025");
  });
  it("reads a database date without shifting the day", () => {
    expect(formatDate("2026-11-01")).toBe("01-11-2026");
    expect(formatDate("2026-12-31")).toBe("31-12-2026");
  });
  it("names the month", () => {
    expect(formatMonth("2026-11-01")).toBe("November 2026");
  });
});
