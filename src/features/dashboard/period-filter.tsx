"use client";

import * as React from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/surface";
import { useI18n, type Key } from "@/lib/i18n";
import { checkRange, formatRange, type DateRange, type Preset } from "@/lib/range";
import { cn } from "@/lib/utils";

const PRESETS: { id: Exclude<Preset, "custom">; label: Key }[] = [
  { id: "today", label: "dash.today" },
  { id: "yesterday", label: "dash.yesterday" },
  { id: "week", label: "dash.week" },
  { id: "month", label: "dash.month" },
  { id: "year", label: "dash.year" },
];

const CHIP =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded border px-2 py-1 text-center text-sm font-medium leading-tight sm:whitespace-nowrap sm:px-3";

/** The period buttons: Today, Yesterday, This week, This month, This year, Custom dates. */
export function PeriodButtons({ preset, onPick, onCustom, className }: { preset: Preset; onPick: (p: Exclude<Preset, "custom">) => void; onCustom: () => void; className?: string }) {
  const { t } = useI18n();
  const style = (active: boolean) => cn(CHIP, active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2");
  return (
    <div role="group" aria-label={t("dash.periodLabel")} className={cn("grid grid-cols-3 gap-2 sm:flex sm:flex-wrap", className)}>
      {PRESETS.map((p) => (
        <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => onPick(p.id)} className={style(preset === p.id)}>
          {t(p.label)}
        </button>
      ))}
      <button type="button" aria-pressed={preset === "custom"} onClick={onCustom} className={style(preset === "custom")}>
        <CalendarBlank size={16} className="hidden shrink-0 sm:block" />
        {t("dash.custom")}
      </button>
    </div>
  );
}

/** The exact dates being shown, for example "1 – 30 Nov 2026". */
export function RangeLabel({ range, className }: { range: DateRange | null; className?: string }) {
  const { t } = useI18n();
  if (!range) return <Skeleton className={cn("h-10 w-44", className)} />;
  const text = formatRange(range);
  return (
    <p aria-live="polite" className={cn("flex h-10 items-center gap-2 rounded border border-line bg-surface px-3 text-sm", className)}>
      <CalendarBlank size={18} className="shrink-0 text-muted" aria-hidden />
      <span className="sr-only">{t("dash.shownDates")}: </span>
      <span className="whitespace-nowrap font-medium tabular-nums">{text}</span>
    </p>
  );
}

/** Pick any two dates. Both are included. */
export function CustomRangeDialog({ open, onOpenChange, initial, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; initial: DateRange | null; onApply: (range: DateRange) => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("custom.title")} description={t("custom.text")}>
        {/* Mounted only while open, so it always starts from the dates currently shown. */}
        {open ? (
          <CustomRangeForm
            initial={initial}
            onCancel={() => onOpenChange(false)}
            onApply={(r) => {
              onApply(r);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CustomRangeForm({ initial, onCancel, onApply }: { initial: DateRange | null; onCancel: () => void; onApply: (range: DateRange) => void }) {
  const { t } = useI18n();
  const [from, setFrom] = React.useState(initial?.from ?? "");
  const [to, setTo] = React.useState(initial?.to ?? "");
  const [error, setError] = React.useState<{ field: "from" | "to"; message: string }>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkRange(from, to);
    if (problem === "missing") return setError({ field: from ? "to" : "from", message: t("custom.errMissing") });
    if (problem === "order") return setError({ field: "to", message: t("custom.errOrder") });
    onApply({ from, to });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("custom.from")} htmlFor="cr-from" error={error?.field === "from" ? error.message : undefined}>
          <Input id="cr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={error?.field === "from"} autoFocus className="h-11 text-base" />
        </Field>
        <Field label={t("custom.to")} htmlFor="cr-to" error={error?.field === "to" ? error.message : undefined}>
          <Input id="cr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={error?.field === "to"} className="h-11 text-base" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel} size="lg">
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" size="lg">
          {t("custom.show")}
        </Button>
      </div>
    </form>
  );
}
