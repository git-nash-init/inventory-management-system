import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signature check for future payment gateway or GSP callbacks.
 * Use on the raw request body, with a secret read from the environment on the server.
 * Compares in constant time and rejects stale timestamps to stop replays.
 */
export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export function verifyWebhook(opts: { secret: string; body: string; signature: string | null; timestamp: string | null; toleranceSec?: number; now?: number }): VerifyResult {
  if (!opts.secret || !opts.signature || !opts.timestamp) return { ok: false, reason: "missing" };
  const ts = Number(opts.timestamp);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > (opts.toleranceSec ?? 300)) return { ok: false, reason: "stale" };
  const expected = Buffer.from(signPayload(opts.secret, ts, opts.body), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(opts.signature, "hex");
  } catch {
    return { ok: false, reason: "mismatch" };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
