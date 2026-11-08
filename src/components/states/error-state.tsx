"use client";

import { Button } from "@/components/ui/button";
import { WarningCircle } from "@phosphor-icons/react";

export type ErrorBlame = "ours" | "network" | "input";

const COPY: Record<ErrorBlame, { who: string; fix: string }> = {
  ours: {
    who: "This is a problem on our side, not something you did.",
    fix: "Try again in a minute. If it keeps happening, contact support and quote the reference below.",
  },
  network: {
    who: "We could not reach the server. Your internet connection may be slow or down.",
    fix: "Check your connection and retry. Anything you typed is saved on this device.",
  },
  input: {
    who: "Something in the data you sent was not accepted.",
    fix: "Review the highlighted fields, correct them and submit again.",
  },
};

/** State 3: says what failed, whose fault it is, and how to fix it. */
export function ErrorState({
  what,
  blame = "ours",
  detail,
  reference,
  onRetry,
}: {
  what: string;
  blame?: ErrorBlame;
  detail?: string;
  reference?: string;
  onRetry?: () => void;
}) {
  const c = COPY[blame];
  return (
    <div role="alert" className="mx-auto max-w-lg px-6 py-12 text-center">
      <WarningCircle size={28} className="mx-auto mb-3 text-bad" />
      <h2 className="text-base font-semibold">{what}</h2>
      <p className="mt-1 text-sm text-muted">{c.who}</p>
      {detail ? <p className="mt-2 text-sm">{detail}</p> : null}
      <p className="mt-2 text-sm text-muted">{c.fix}</p>
      {reference ? <p className="num mt-3 text-xs text-muted">Reference: {reference}</p> : null}
      <div className="mt-4 flex justify-center gap-2">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <a href="mailto:support@example.com" className="inline-flex h-9 items-center rounded border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2">
          Contact support
        </a>
      </div>
    </div>
  );
}
