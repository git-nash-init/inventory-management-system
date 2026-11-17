"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

/** Shown when a page could not load its data. Says what happened in plain words and offers a retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, unit } = useI18n();
  return (
    <div role="alert" className="mx-auto max-w-lg px-6 py-12 text-center">
      <WarningCircle size={32} className="mx-auto mb-3 text-bad" />
      <h2 className="text-base font-semibold">{t("err.loadFailed")}</h2>
      <p className="mt-1 text-sm text-muted">{friendlyError(error, t, unit)}</p>
      {onRetry ? (
        <Button variant="primary" size="lg" className="mt-4" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
