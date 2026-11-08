"use client";

import { ErrorState } from "@/components/states/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <ErrorState
      what="This page could not be shown"
      blame={offline ? "network" : "ours"}
      reference={error.digest}
      onRetry={reset}
    />
  );
}
