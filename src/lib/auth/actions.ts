"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfigured } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { fieldErrors, forgotSchema, loginSchema, mfaCodeSchema, signupSchema } from "@/lib/validation/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fields?: Record<string, string> };

const notConfigured: ActionResult = {
  ok: false,
  message: "Supabase is not connected yet. Add the project URL and key to .env.local, or use the demo.",
};

// Generic wording: never reveal whether an email exists.
const BAD_LOGIN = "Email or password is incorrect. Check both and try again, or reset your password.";

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult<{ needsMfa: boolean }>> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: BAD_LOGIN };
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    return { ok: true, data: { needsMfa: true } };
  }
  redirect(safeNext(next));
}

export async function signupAction(input: unknown): Promise<ActionResult<{ confirmEmail: boolean }>> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: { data: { full_name: d.name } },
  });
  if (error) {
    return { ok: false, message: "We could not create the account. If you already have one, sign in or reset your password." };
  }
  if (data.session) {
    const { error: rpcErr } = await supabase.rpc("create_business", {
      p_name: d.businessName,
      p_gstin: d.gstin ?? "",
      p_state_code: d.gstin ? d.gstin.slice(0, 2) : "27",
    });
    if (rpcErr) return { ok: false, message: "Your account was created but the business could not be set up. Sign in to finish setup." };
    redirect("/dashboard");
  }
  return { ok: true, data: { confirmEmail: true } };
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  // Same response whether or not the email exists.
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  if (supabaseConfigured) {
    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function reauthAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return notConfigured;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter your email and password.", fields: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? { ok: false, message: BAD_LOGIN } : { ok: true };
}

export async function enrollMfaAction(): Promise<ActionResult<{ factorId: string; qr: string; secret: string }>> {
  if (!supabaseConfigured) return notConfigured;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error || !data) return { ok: false, message: "We could not start two-factor setup. Sign in again and retry." };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyMfaAction(factorId: unknown, input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return notConfigured;
  const id = z.string().uuid().safeParse(factorId);
  const parsed = mfaCodeSchema.safeParse(input);
  if (!id.success) return { ok: false, message: "Two-factor setup expired. Start again." };
  if (!parsed.success) return { ok: false, message: "Fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id.data, code: parsed.data.code });
  if (error) return { ok: false, message: "That code is wrong or expired. Enter the current 6 digit code.", fields: { code: "Code did not match" } };
  return { ok: true };
}

export async function listMfaFactorsAction(): Promise<ActionResult<{ factorId?: string }>> {
  if (!supabaseConfigured) return notConfigured;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp?.find((f) => f.status === "verified");
  return { ok: true, data: { factorId: verified?.id } };
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
