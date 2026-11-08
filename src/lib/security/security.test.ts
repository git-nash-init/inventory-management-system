// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { redact, redactString } from "./redact";
import { signPayload, verifyWebhook } from "./hmac";
import { assertSafeUrl, isPrivateHost } from "./ssrf";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("log redaction", () => {
  it("removes tokens, emails and account numbers from strings", () => {
    const s = redactString("user a@b.com Bearer abcdefghijklmnop acct 123456789012 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r");
    expect(s).not.toMatch(/a@b\.com|abcdefghijklmnop|123456789012|eyJ/);
  });
  it("redacts secret and personal keys deeply", () => {
    const out = redact({ user: { email: "a@b.com", password: "hunter2", profile: { gstin: "27ABCDE1234F1Z5" } }, amount: 5, token: "x" }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/hunter2|27ABCDE|a@b\.com/);
    expect((out as { amount: number }).amount).toBe(5);
  });
});

describe("webhook verification", () => {
  const secret = "s3cret";
  const body = '{"id":1}';
  const now = 1_800_000_000;
  const sig = signPayload(secret, now, body);
  it("accepts a correct signature", () => {
    expect(verifyWebhook({ secret, body, signature: sig, timestamp: String(now), now })).toEqual({ ok: true });
  });
  it("rejects a tampered body, a wrong signature and missing headers", () => {
    expect(verifyWebhook({ secret, body: '{"id":2}', signature: sig, timestamp: String(now), now })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhook({ secret, body, signature: "zz", timestamp: String(now), now })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhook({ secret, body, signature: null, timestamp: null, now })).toEqual({ ok: false, reason: "missing" });
  });
  it("rejects a replay outside the tolerance window", () => {
    expect(verifyWebhook({ secret, body, signature: sig, timestamp: String(now), now: now + 3600 })).toEqual({ ok: false, reason: "stale" });
  });
});

describe("SSRF guard", () => {
  it("blocks private, loopback, metadata and encoded hosts", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.1", "[::1]", "2130706433", "0x7f000001", "db.internal"]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
    expect(isPrivateHost("api.example.com")).toBe(false);
  });
  it("requires https, no credentials and an allowlisted host", () => {
    expect(() => assertSafeUrl("http://api.example.com/x", ["example.com"])).toThrow();
    expect(() => assertSafeUrl("https://user:pw@api.example.com/x", ["example.com"])).toThrow();
    expect(() => assertSafeUrl("https://evil.com/x", ["example.com"])).toThrow();
    expect(() => assertSafeUrl("https://169.254.169.254/latest", ["169.254.169.254"])).toThrow();
    expect(assertSafeUrl("https://api.example.com/x", ["example.com"]).hostname).toBe("api.example.com");
  });
});

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());
  it("allows up to the limit then blocks with a retry hint, then recovers", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 1000 + i).allowed).toBe(true);
    const blocked = rateLimit("k", 3, 1000, 1500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("k", 3, 1000, 2500).allowed).toBe(true);
  });
  it("keeps separate buckets per key", () => {
    expect(rateLimit("a", 1, 1000, 0).allowed).toBe(true);
    expect(rateLimit("b", 1, 1000, 0).allowed).toBe(true);
    expect(rateLimit("a", 1, 1000, 1).allowed).toBe(false);
  });
});
