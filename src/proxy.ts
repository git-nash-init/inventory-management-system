import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DATA_MODE, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const PROTECTED = ["/dashboard", "/inventory", "/sales", "/purchases", "/accounting", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

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
  const { pathname } = request.nextUrl;
  const ip = clientIp(request.headers);

  // Rate limiting: tight on auth endpoints, looser on any mutation.
  const isAuthPath = AUTH_PAGES.some((p) => pathname.startsWith(p)) || pathname.startsWith("/mfa");
  if (request.method === "POST") {
    const lim = isAuthPath ? rateLimit(`auth:${ip}`, 10, 60_000) : rateLimit(`mut:${ip}`, 120, 60_000);
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
    const signedIn = Boolean(data?.claims);

    if (!signedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("Content-Security-Policy", csp);
      return redirect;
    }
    if (signedIn && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
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
