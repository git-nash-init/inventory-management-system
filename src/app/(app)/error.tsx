"use client";

import { LoadError } from "@/components/states/load-error";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError error={error} onRetry={reset} />;
}
