"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useLiteMode } from "./lite-mode";

const SLOW_AFTER_MS = 4000;

/**
 * State 5: slow network. A top progress bar tracks real in-flight fetches.
 * After 4 seconds a request is still pending, offer lite view.
 * Also emits "session-expired" when any same-origin API call returns 401 (state 8).
 */
export function NetworkActivity() {
  const [pending, setPending] = React.useState(0);
  const [slow, setSlow] = React.useState(false);
  const { lite, setLite } = useLiteMode();
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const counter = React.useRef(0);

  React.useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const id = ++counter.current;
      setPending((p) => p + 1);
      timers.current.set(
        id,
        setTimeout(() => setSlow(true), SLOW_AFTER_MS),
      );
      try {
        const res = await original(...args);
        if (res.status === 401) window.dispatchEvent(new Event("session-expired"));
        return res;
      } finally {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setPending((p) => {
          const next = Math.max(0, p - 1);
          if (next === 0) setSlow(false);
          return next;
        });
      }
    };
    const t = timers.current;
    return () => {
      window.fetch = original;
      t.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="no-print fixed left-0 top-0 z-50 h-0.5 bg-accent"
        style={{ width: pending > 0 ? (slow ? "90%" : "60%") : "0%", opacity: pending > 0 ? 1 : 0, transition: "width 4s ease-out, opacity 0.2s" }}
      />
      {slow && !lite ? (
        <div role="status" className="no-print flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-sm">
          <span>This is taking longer than usual. Your connection looks slow.</span>
          <Button size="sm" variant="primary" onClick={() => setLite(true)}>
            Switch to lite view
          </Button>
        </div>
      ) : null}
      {lite ? (
        <div role="status" className="no-print flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-1.5 text-xs text-muted">
          <span>Lite view is on. Charts and images are hidden and lists show fewer rows.</span>
          <button className="link" onClick={() => setLite(false)}>
            Turn off
          </button>
        </div>
      ) : null}
    </>
  );
}
