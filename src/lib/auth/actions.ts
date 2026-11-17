"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfigured } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fields?: Record<string, string> };

const notConfigured: ActionResult = {
  ok: false,
  message: "Supabase is not connected yet. Add the project URL and key to .env.local, or use the demo.",
};


export async function signOutAction(): Promise<void> {
  if (supabaseConfigured) {
    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/");
}


export async function createBusinessAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = z.object({ name: z.string().trim().min(2, "Enter your business name"), stateCode: z.string().regex(/^[0-9]{2}$/, "Choose a state") }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("create_business", { p_name: parsed.data.name, p_gstin: "", p_state_code: parsed.data.stateCode });
  if (error) return { ok: false, message: "We could not create the business. Try again." };
  return { ok: true };
}

export async function inviteMemberAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = z
    .object({
      businessId: z.string().uuid(),
      email: z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email must look like name@example.com"),
      name: z.string().trim().max(80),
      role: z.enum(["owner", "manager", "accountant", "sales", "storekeeper"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  // Authorisation runs in Postgres as the signed in user: only an owner passes has_permission(users, edit).
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("invite_member", { p_business: d.businessId, p_email: d.email, p_name: d.name, p_role: d.role });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only an owner can add team members." };
    if (error.code === "23505") return { ok: false, message: "This email already has access.", fields: { email: "Already has access" } };
    return { ok: false, message: error.message };
  }
  // Best effort: email an invitation so they can set a password. The membership is already in place.
  try {
    const { getAdminSupabase } = await import("@/lib/supabase/admin");
    await getAdminSupabase().auth.admin.inviteUserByEmail(d.email);
  } catch {
    /* the person may already have an account, or the service key is not configured */
  }
  return { ok: true };
}
