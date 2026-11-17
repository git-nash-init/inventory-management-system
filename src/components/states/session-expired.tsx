"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * State 8: connection expired. Opens in place over the current page when any request returns 401.
 * Form state on the page underneath is untouched, and drafts are already in IndexedDB.
 * There is no sign in: reconnecting asks the server to open a fresh session.
 */
export function SessionExpiredDialog({ onReconnect }: { onReconnect: () => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);

  async function reconnect() {
    setBusy(true);
    setError(undefined);
    let ok = false;
    try {
      ok = await onReconnect();
    } catch {
      ok = false;
    }
    setBusy(false);
    if (ok) {
      setOpen(false);
      window.dispatchEvent(new Event("session-restored"));
    } else {
      setError("Could not reconnect. Check your internet connection and try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* cannot be dismissed without reconnecting */ }}>
      <DialogContent
        hideClose
        title="Connection expired"
        description="Reconnect to continue. Your unsaved work on this page is kept."
      >
        {error ? <p role="alert" className="mb-3 text-sm text-bad">{error}</p> : null}
        <Button variant="primary" disabled={busy} onClick={() => void reconnect()} className="w-full">
          {busy ? "Reconnecting" : "Reconnect and continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
