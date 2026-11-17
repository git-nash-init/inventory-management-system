import { round2 } from "@/lib/format/money";

/** "1,200.50" -> 1200.5. Empty or not a number -> null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type BillLine = { qty: number; price: number };

export type BillTotals = {
  amounts: number[];
  subtotal: number;
  gstAmount: number;
  total: number;
};

/**
 * Same rounding as the database function create_invoice: each line is rounded to paise,
 * GST (if a percent is given) is worked out once on the subtotal.
 */
export function calcBill(lines: BillLine[], gstPercent: number | null): BillTotals {
  const amounts = lines.map((l) => round2(l.qty * l.price));
  const subtotal = round2(amounts.reduce((a, b) => a + b, 0));
  const gstAmount = gstPercent && gstPercent > 0 ? round2((subtotal * gstPercent) / 100) : 0;
  return { amounts, subtotal, gstAmount, total: round2(subtotal + gstAmount) };
}

/** Number 12 -> "BILL-0012". */
export function billNumber(n: number): string {
  return `BILL-${String(n).padStart(4, "0")}`;
}

/** Digits (and a leading +) only. 10 or more digits is accepted: 98765 43210, +91 98765 43210. */
export function isValidMobile(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

/** First day of the month, `offset` months from today, as YYYY-MM-01. */
export function monthStart(offset: number, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
