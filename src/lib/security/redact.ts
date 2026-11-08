/** Keeps secrets and personal data out of logs. Use `log` instead of console in server code. */
const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|apikey|jwt|service[-_]?role|signature|otp|code$/i;
const PII_KEYS = /^(email|phone|gstin|pan|address|name|bank_?account|ifsc|upi_?id|party_?name|party_?gstin)$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const LONG_DIGITS = /\b\d{9,18}\b/g; // account numbers, phone numbers with country code

export function redactString(s: string): string {
  return s.replace(JWT, "[jwt]").replace(BEARER, "$1 [redacted]").replace(EMAIL, "[email]").replace(LONG_DIGITS, "[number]");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : PII_KEYS.test(k) ? "[pii]" : redact(v, depth + 1)]),
    );
  }
  return value;
}

export const log = {
  info: (msg: string, data?: unknown) => console.info(redactString(msg), data === undefined ? "" : redact(data)),
  warn: (msg: string, data?: unknown) => console.warn(redactString(msg), data === undefined ? "" : redact(data)),
  error: (msg: string, data?: unknown) => console.error(redactString(msg), data === undefined ? "" : redact(data)),
};
