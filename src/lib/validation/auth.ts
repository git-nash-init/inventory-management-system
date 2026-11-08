import { z } from "zod";
import { validateGstin } from "@/lib/gst/gstin";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email must look like name@example.com");

/** Matches the policy configured in Supabase Auth: 10+ characters with a letter and a number. */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    businessName: z.string().trim().min(2, "Enter your business name"),
    gstin: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || validateGstin(v).valid, {
        message: "GSTIN must be 15 characters like 27ABCDE1234F1Z5",
      }),
    accepted: z.boolean().refine((v) => v, "Accept the Terms of Service and Privacy Policy to continue"),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const forgotSchema = z.object({ email: emailSchema });

export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6 digit code from your authenticator app"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

/** Flatten a ZodError into { field: message } using the first message per field. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
