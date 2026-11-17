import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DATA_MODE, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

// There is no login page. The server signs in to the shared account below on a visitor's first request
// and stores the session in cookies, so Row Level Security still applies to every query.
// Set both in the host's environment variables (server only, never NEXT_PUBLIC_).
const AUTO_LOGIN_EMAIL = process.env.AUTO_LOGIN_EMAIL ?? "";
const AUTO_LOGIN_PASSWORD = process.env.AUTO_LOGIN_PASSWORD ?? "";

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

  let response = NextResponse.next({ request });

  if (DATA_MODE === "supabase") {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    // Must run before any response is built so a refreshed token can be written to cookies.
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims && AUTO_LOGIN_EMAIL && AUTO_LOGIN_PASSWORD) {
      const { error } = await supabase.auth.signInWithPassword({ email: AUTO_LOGIN_EMAIL, password: AUTO_LOGIN_PASSWORD });
      if (error) console.error("[auto-login] sign in failed:", error.code ?? error.message);
    }
    response.headers.set("Cache-Control", "private, no-store");
  }

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
