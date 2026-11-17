import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  let supabaseOrigin = "";
  let supabaseWs = "";
  try {
    if (SUPABASE_URL) {
      const u = new URL(SUPABASE_URL);
      supabaseOrigin = u.origin;
      supabaseWs = `wss://${u.host}`;
    }
  } catch {
    /* invalid URL: leave blank */
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by charts and skeletons. Scripts stay strictly nonce-based.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${dev ? " ws://localhost:* http://localhost:*" : ""}`.replace(/\s+/g, " ").trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const ip = clientIp(request.headers);

  // Rate limiting on any mutation.
  if (request.method === "POST") {
    const lim = rateLimit(`mut:${ip}`, 120, 60_000);
    if (!lim.allowed) {
      return new NextResponse("Too many requests. Wait a moment and try again.", {
        status: 429,
        headers: { "Retry-After": String(lim.retryAfterSec), "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
