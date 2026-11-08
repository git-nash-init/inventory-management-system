const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> DD-MM-YYYY */
export function formatDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
/** Date -> YYYY-MM-DD (for inputs and storage) */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
export function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

/** Indian financial year runs April to March. Returns the start year, e.g. Nov 2025 -> 2025, Feb 2026 -> 2025. */
export function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
/** 2025 -> "25-26" */
export function fyLabelShort(startYear: number): string {
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}
/** 2025 -> "2025-26" */
export function fyLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}
export function fyRange(startYear: number): { from: Date; to: Date } {
  return { from: new Date(startYear, 3, 1), to: new Date(startYear + 1, 2, 31) };
}
/** INV/25-26/0042 */
export function formatDocNumber(prefix: string, startYear: number, seq: number, width = 4): string {
  return `${prefix}/${fyLabelShort(startYear)}/${String(seq).padStart(width, "0")}`;
}
