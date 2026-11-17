import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";
import type { Database } from "./database.types";

export class NotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "NotConfiguredError";
  }
}

let client: SupabaseClient<Database> | undefined;

/** Browser client using the public key. There is no sign in, so no session is stored or refreshed. */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    if (!supabaseConfigured) throw new NotConfiguredError();
    client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
