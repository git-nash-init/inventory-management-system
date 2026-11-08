/**
 * The app never fetches a user-supplied URL on the server. If a feature ever needs to (link previews,
 * GSP callbacks), route it through assertSafeUrl with an explicit host allowlist.
 */
const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return PRIVATE_V4.some((r) => r.test(h));
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return true; // integer or hex encoded IPv4
  return false;
}

export function assertSafeUrl(raw: string, allowedHosts: string[]): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (u.protocol !== "https:") throw new Error("Only https URLs are allowed");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  if (isPrivateHost(u.hostname)) throw new Error("That host is not allowed");
  if (!allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) throw new Error("That host is not on the allowlist");
  return u;
}
