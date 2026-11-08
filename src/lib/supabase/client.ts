"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client. Session lives in HTTP cookies managed by @supabase/ssr, never in localStorage. */
export function getBrowserSupabase() {
  if (!client) client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
