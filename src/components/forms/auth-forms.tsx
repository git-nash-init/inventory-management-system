"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SuccessPanel } from "@/components/states/success-panel";
import { isDemo } from "@/lib/env";
import { demoSignIn } from "@/lib/auth/demo-session";
import {
  enrollMfaAction,
  forgotPasswordAction,
  listMfaFactorsAction,
  loginAction,
  signupAction,
  verifyMfaAction,
} from "@/lib/auth/actions";
import { forgotSchema, loginSchema, mfaCodeSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validation/auth";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-bad/40 bg-bad-bg px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}

function DemoNote() {
  if (!isDemo) return null;
  return (
    <p className="rounded border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
      Demo mode: no account is needed. Any valid email and a password of 10+ characters with a letter and a number signs you in to sample data stored only in this browser.
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [formError, setFormError] = React.useState<string>();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: LoginInput) {
    setFormError(undefined);
    if (isDemo) {
      demoSignIn(v.email);
      router.push(next.startsWith("/") ? next : "/dashboard");
      return;
    }
    const res = await loginAction(v, next);
    if (!res.ok) {
      setFormError(res.message);
      for (const [k, m] of Object.entries(res.fields ?? {})) form.setError(k as keyof LoginInput, { message: m });
    } else if (res.data?.needsMfa) {
      router.push(`/mfa?next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to your books.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        <DemoNote />
        <FormError message={formError} />
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} {...form.register("password")} />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
        {isDemo ? (
          <Button
            className="w-full"
            onClick={() => {
              demoSignIn("owner@example.com");
              router.push("/dashboard");
            }}
          >
            Open the demo business
          </Button>
        ) : null}
      </form>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="link">Forgot your password?</Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        New here? <Link href="/signup" className="link">Create an account</Link>
      </p>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string>();
  const [done, setDone] = React.useState(false);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirm: "", businessName: "", gstin: "", accepted: false },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: SignupInput) {
    setFormError(undefined);
    if (isDemo) {
      demoSignIn(v.email, v.name);
      router.push("/dashboard");
      return;
    }
    const res = await signupAction({ ...v, gstin: v.gstin?.toUpperCase() });
    if (!res.ok) {
      setFormError(res.message);
      for (const [k, m] of Object.entries(res.fields ?? {})) form.setError(k as keyof SignupInput, { message: m });
    } else if (res.data?.confirmEmail) setDone(true);
  }

  if (done) {
    return (
      <SuccessPanel
        title="Check your email to confirm your account"
        detail="We sent a confirmation link. Open it, then sign in to finish setting up your business."
        steps={[{ label: "Go to sign in", href: "/login" }]}
      />
    );
  }

  const f = (name: keyof SignupInput) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `${name}-error` : undefined });

  return (
    <div>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">You become the owner of the business. You can invite your team later.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        <DemoNote />
        <FormError message={formError} />
        <Field label="Your full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" {...f("name")} {...form.register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="username" {...f("email")} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 10 characters with a letter and a number." required>
          <Input id="password" type="password" autoComplete="new-password" {...f("password")} {...form.register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message} required>
          <Input id="confirm" type="password" autoComplete="new-password" {...f("confirm")} {...form.register("confirm")} />
        </Field>
        <Field label="Business name" htmlFor="businessName" error={errors.businessName?.message} required>
          <Input id="businessName" {...f("businessName")} {...form.register("businessName")} />
        </Field>
        <Field label="GSTIN (optional)" htmlFor="gstin" error={errors.gstin?.message} hint="Leave empty if you are not registered. You can add it later.">
          <Input id="gstin" className="num uppercase" maxLength={15} {...f("gstin")} {...form.register("gstin")} />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" {...form.register("accepted")} />
            <span>
              I accept the <Link href="/terms" className="link" target="_blank">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="link" target="_blank">Privacy Policy</Link>.
            </span>
          </label>
          {errors.accepted ? <p role="alert" className="mt-1 text-xs text-bad">{errors.accepted.message}</p> : null}
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link href="/login" className="link">Sign in</Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const [done, setDone] = React.useState(false);
  const [formError, setFormError] = React.useState<string>();
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: { email: string }) {
    setFormError(undefined);
    if (isDemo) return setDone(true);
    const res = await forgotPasswordAction(v);
    if (res.ok) setDone(true);
    else setFormError(res.message);
  }

  if (done) {
    return (
      <SuccessPanel
        title="If that email has an account, a reset link is on its way"
        detail="Check your inbox and spam folder. The link works for one hour."
        steps={[{ label: "Back to sign in", href: "/login" }]}
      />
    );
  }
  return (
    <div>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter the email you signed up with.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="link">Back to sign in</Link></p>
    </div>
  );
}

export function MfaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [factorId, setFactorId] = React.useState<string>();
  const [enroll, setEnroll] = React.useState<{ factorId: string; qr: string; secret: string }>();
  const [loadError, setLoadError] = React.useState<string>();
  const [ready, setReady] = React.useState(isDemo);
  const [formError, setFormError] = React.useState<string>();
  const form = useForm<{ code: string }>({ resolver: zodResolver(mfaCodeSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (isDemo) return;
    let alive = true;
    (async () => {
      const f = await listMfaFactorsAction();
      if (!alive) return;
      if (f.ok && f.data?.factorId) {
        setFactorId(f.data.factorId);
        setReady(true);
        return;
      }
      const e = await enrollMfaAction();
      if (!alive) return;
      if (e.ok && e.data) setEnroll(e.data);
      else setLoadError(e.ok ? "Could not start setup." : e.message);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(v: { code: string }) {
    setFormError(undefined);
    const id = factorId ?? enroll?.factorId;
    const res = await verifyMfaAction(id, v);
    if (res.ok) router.push(next.startsWith("/") ? next : "/dashboard");
    else {
      setFormError(res.message);
      if (res.fields?.code) form.setError("code", { message: res.fields.code });
    }
  }

  if (isDemo) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Two-factor authentication</h1>
        <p className="mt-2 text-sm text-muted">Authenticator app codes are enforced by Supabase Auth, so this step is active once Supabase is connected. Owners and accountants should turn it on.</p>
        <Link href="/dashboard" className="link mt-4 inline-block text-sm">Continue to the demo</Link>
      </div>
    );
  }
  if (!ready) return <p className="text-sm text-muted">Preparing two-factor setup</p>;
  return (
    <div>
      <h1 className="text-xl font-semibold">{enroll ? "Set up two-factor authentication" : "Enter your 6 digit code"}</h1>
      {enroll ? (
        <div className="mt-3 text-sm">
          <p className="text-muted">Scan this QR code with an authenticator app such as Google Authenticator, then enter the code it shows.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" width={176} height={176} className="my-3 border border-line bg-white p-2" />
          <p className="text-xs text-muted">Cannot scan? Enter this key: <span className="num select-all">{enroll.secret}</span></p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">Open your authenticator app and enter the current code.</p>
      )}
      {loadError ? <FormError message={loadError} /> : null}
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="6 digit code" htmlFor="code" error={errors.code?.message}>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="num" aria-invalid={Boolean(errors.code)} {...form.register("code")} />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Checking" : "Verify"}
        </Button>
      </form>
    </div>
  );
}
