import * as React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/** State 1: nothing here yet. Says why and offers the next step. */
export function EmptyState({
  title,
  reason,
  actionLabel,
  actionHref,
  onAction,
  secondary,
  icon,
}: {
  title: string;
  reason: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondary?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="status">
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{reason}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="inline-flex h-9 items-center rounded border border-accent bg-accent px-3.5 text-sm font-medium text-accent-ink hover:bg-ink hover:border-ink">
            {actionLabel}
          </Link>
        ) : actionLabel && onAction ? (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
        {secondary}
      </div>
    </div>
  );
}
