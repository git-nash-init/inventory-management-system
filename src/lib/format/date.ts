const pad = (n: number) => String(n).padStart(2, "0");

/** A plain YYYY-MM-DD from the database is a calendar date, not a moment: read it without time zone shifts. */
function parse(input: Date | string): Date {
  if (typeof input !== "string") return input;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(input);
}

/** Date or YYYY-MM-DD -> DD-MM-YYYY */
export function formatDate(input: Date | string): string {
  const d = parse(input);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Date -> YYYY-MM-DD (for inputs and storage) */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
