import { describe, expect, it } from "vitest";
import {
  amountInWords,
  formatAmount,
  formatDate,
  formatDocNumber,
  formatINR,
  fyLabel,
  fyLabelShort,
  fyStartYear,
  round2,
} from "./index";

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

describe("dates and financial year", () => {
  it("formats DD-MM-YYYY", () => {
    expect(formatDate(new Date(2025, 10, 8))).toBe("08-11-2025");
  });
  it("rolls the FY over on 1 April", () => {
    expect(fyStartYear(new Date(2026, 2, 31))).toBe(2025);
    expect(fyStartYear(new Date(2026, 3, 1))).toBe(2026);
    expect(fyStartYear(new Date(2025, 10, 8))).toBe(2025);
  });
  it("labels and numbers documents per FY", () => {
    expect(fyLabelShort(2025)).toBe("25-26");
    expect(fyLabel(2025)).toBe("2025-26");
    expect(formatDocNumber("INV", 2025, 42)).toBe("INV/25-26/0042");
  });
});
