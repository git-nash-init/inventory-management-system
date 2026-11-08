"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export type ReauthFn = (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;

/**
 * State 8: session expired. Opens in place over the current page when any request returns 401.
 * Form state on the page underneath is untouched, and drafts are already in IndexedDB.
 */
export function SessionExpiredDialog({ email, onReauth }: { email?: string; onReauth: ReauthFn }) {
  const [open, setOpen] = React.useState(false);
  const [mail, setMail] = React.useState(email ?? "");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await onReauth(mail, password);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setPassword("");
      window.dispatchEvent(new Event("session-restored"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* cannot be dismissed without signing in */ }}>
      <DialogContent
        hideClose
        title="Your session expired"
        description="Sign in again to continue. Your unsaved work on this page is kept."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email" htmlFor="re-email">
            <Input id="re-email" type="email" autoComplete="username" value={mail} onChange={(e) => setMail(e.target.value)} required />
          </Field>
          <Field label="Password" htmlFor="re-password" error={error}>
            <Input
              id="re-password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "re-password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? "Signing in" : "Sign in and continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
