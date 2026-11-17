// Date ranges for the Home page filters. Dates are plain calendar days written YYYY-MM-DD (no time of day),
// so they cannot shift by a day with the time zone.

export type Preset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export type DateRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a Date as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Ymd = { y: number; m: number; d: number };

/** Reads YYYY-MM-DD strictly. Returns null for anything that is not a real calendar day (2026-02-30, "abc", ""). */
export function parseDay(text: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

function fromYmd(v: Ymd): Date {
  return new Date(v.y, v.m - 1, v.d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * The dates a preset covers. Weeks run Monday to Sunday. Today, This week, This month and This year
 * are whole calendar periods (the future part of the period simply has nothing in it yet).
 * "custom" returns the given dates unchanged.
 */
export function rangeFor(preset: Preset, today: Date, custom?: DateRange): DateRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case "today":
      return { from: isoDay(t), to: isoDay(t) };
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: isoDay(y), to: isoDay(y) };
    }
    case "week": {
      const sinceMonday = (t.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
      const monday = addDays(t, -sinceMonday);
      return { from: isoDay(monday), to: isoDay(addDays(monday, 6)) };
    }
    case "month":
      return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoDay(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
    case "year":
      return { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` };
    case "custom":
      return custom ?? { from: isoDay(t), to: isoDay(t) };
  }
}

/** Both dates are real calendar days and the end is not before the start. */
export type RangeProblem = "missing" | "order";
export function checkRange(from: string, to: string): RangeProblem | null {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return "missing";
  return fromYmd(a).getTime() > fromYmd(b).getTime() ? "order" : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The exact dates as short, readable text.
 *   one day              17 Nov 2026
 *   inside one month     1 – 30 Nov 2026
 *   inside one year      1 Jan – 31 Dec 2026
 *   across years         28 Dec 2025 – 3 Jan 2026
 * Month names stay in English letters in both languages, because that is how dates are read on bills.
 */
export function formatRange(range: DateRange): string {
  const a = parseDay(range.from);
  const b = parseDay(range.to);
  if (!a || !b) return "";
  const dash = " – "; // en dash with spaces
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}${dash}${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]}${dash}${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${a.d} ${MONTHS[a.m - 1]} ${a.y}${dash}${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}
