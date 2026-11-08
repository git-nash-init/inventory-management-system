/** Public configuration. Nothing secret lives here. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Real Supabase only when asked for AND configured. Otherwise the in-memory demo adapter runs. */
export const DATA_MODE: "demo" | "supabase" =
  process.env.NEXT_PUBLIC_DATA_MODE === "supabase" && supabaseConfigured ? "supabase" : "demo";

export const isDemo = DATA_MODE === "demo";
