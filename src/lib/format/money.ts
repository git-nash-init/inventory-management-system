const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

/** 12345678 -> ₹1,23,45,678.00 */
export function formatINR(value: number): string {
  return inr.format(round2(value));
}
/** Same grouping without the currency symbol. */
export function formatAmount(value: number): string {
  return plain.format(round2(value));
}
export function formatQty(value: number): string {
  return qty.format(value);
}
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
/** Convert rupees to integer paise safely. */
export function toPaise(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}
export function fromPaise(paise: number): number {
  return paise / 100;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + " Hundred" : "", r ? below100(r) : ""].filter(Boolean).join(" ");
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push((crore >= 100 ? integerToWords(crore) : below100(crore)) + " Crore");
  if (lakh) parts.push(below100(lakh) + " Lakh");
  if (thousand) parts.push(below100(thousand) + " Thousand");
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

/** 12345.5 -> "Rupees Twelve Thousand Three Hundred Forty Five and Fifty Paise Only" */
export function amountInWords(value: number): string {
  const paiseTotal = toPaise(Math.abs(value));
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  let out = "Rupees " + integerToWords(rupees);
  if (paise) out += " and " + below100(paise) + " Paise";
  return out + " Only";
}
