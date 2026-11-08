import * as React from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

export type NextStep = { label: string; href?: string; onClick?: () => void };

/** State 10: success. Confirms exactly what was saved and lists the next steps. */
export function SuccessPanel({
  title,
  detail,
  steps,
}: {
  title: string;
  detail?: string;
  steps: NextStep[];
}) {
  return (
    <div role="status" className="rounded border border-ok/40 bg-ok-bg p-4">
      <div className="flex items-start gap-3">
        <CheckCircle size={22} className="mt-0.5 shrink-0 text-ok" />
        <div className="text-sm">
          <p className="font-semibold text-ok">{title}</p>
          {detail ? <p className="mt-0.5 text-ink">{detail}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {steps.map((s) =>
              s.href ? (
                <Link key={s.label} href={s.href} className="link">
                  {s.label}
                </Link>
              ) : (
                <button key={s.label} onClick={s.onClick} className="link">
                  {s.label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
