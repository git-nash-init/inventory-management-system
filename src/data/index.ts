"use client";

import { DATA_MODE } from "@/lib/env";
import { DemoRepo } from "./demo/demo-repo";
import { SupabaseRepo } from "./supabase/supabase-repo";
import type { Repo } from "./repo";

let repo: Repo | undefined;

/** One repository instance per browser tab. UI code never imports a concrete adapter. */
export function getRepo(): Repo {
  if (!repo) repo = DATA_MODE === "supabase" ? new SupabaseRepo() : new DemoRepo();
  return repo;
}

export function resetDemoData() {
  const r = getRepo();
  if (r instanceof DemoRepo) r.reset();
}
