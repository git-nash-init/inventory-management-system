/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Placeholder. Once Supabase is connected, regenerate this file with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 * (or the Supabase MCP generate_typescript_types tool). Loose types keep the build green until then.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any; Relationships: [] }>;
    Views: Record<string, never>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
