"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/amount";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { LoadError } from "@/components/states/load-error";
import { StatSkeleton, TableSkeleton } from "@/components/states/skeletons";
import { useBills, useDashboard, useProducts } from "@/data/queries";
import { billNumber } from "@/lib/bill";
import { formatDate } from "@/lib/format/date";
import { formatINR, formatQty } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n";
import { isoDay, parseDay, rangeFor, type DateRange, type Preset } from "@/lib/range";
import { cn } from "@/lib/utils";
import { CustomRangeDialog, PeriodButtons, RangeLabel } from "./period-filter";

/** Today's date as text. Null on the server, so the page never shows a date that is wrong for the visitor. */
function subscribeToDayChange(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000); // notices midnight while the page stays open
  return () => window.clearInterval(id);
}
function useToday(): Date | null {
  const iso = React.useSyncExternalStore(subscribeToDayChange, () => isoDay(new Date()), () => null);
  return React.useMemo(() => {
    const day = iso ? parseDay(iso) : null;
    return day ? new Date(day.y, day.m - 1, day.d) : null;
  }, [iso]);
}

function Stat({ label, help, value, note, tone }: { label: string; help: string; value: number; note?: string; tone?: "good" | "bad" }) {
  return (
    <Panel className="min-w-0 p-3 sm:p-4">
      <div className="text-sm font-medium">{label}</div>
      <Money value={value} className={cn("mt-1 block text-lg font-semibold sm:text-2xl", tone === "good" && "text-ok", tone === "bad" && "text-bad")} />
      <p className="mt-2 text-xs text-muted">{help}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </Panel>
  );
}

export function DashboardPage() {
  const { t, unit } = useI18n();
  const today = useToday();
  const [preset, setPreset] = React.useState<Preset>("month");
  const [custom, setCustom] = React.useState<DateRange | undefined>();
  const [customOpen, setCustomOpen] = React.useState(false);
  const range = React.useMemo(() => (today ? rangeFor(preset, today, custom) : null), [today, preset, custom]);
  const dash = useDashboard(range);
  const products = useProducts();
  const bills = useBills(5);

  const low = (products.data ?? []).filter((p) => p.lowStockAt !== null && p.quantity <= p.lowStockAt);
  const brandNew = products.isSuccess && products.data.length === 0 && bills.isSuccess && bills.data.length === 0;

  return (
    <>
      {/* Title, then the period buttons, then the exact dates. On a phone the buttons drop to their own row. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="order-1 text-xl font-semibold">{t("dash.title")}</h1>
        <PeriodButtons
          className="order-3 w-full lg:order-2 lg:w-auto"
          preset={preset}
          onPick={setPreset}
          onCustom={() => setCustomOpen(true)}
        />
        <RangeLabel range={range} className="order-2 ml-auto lg:order-3" />
      </div>
      <CustomRangeDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        initial={range}
        onApply={(r) => {
          setCustom(r);
          setPreset("custom");
        }}
      />

      {brandNew ? <GettingStarted /> : null}

      {dash.isPending ? (
        <StatSkeleton />
      ) : dash.isError ? (
        <LoadError error={dash.error} onRetry={() => void dash.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Stat label={t("dash.sold")} help={t("dash.soldHelp")} value={dash.data.sold} note={[t("dash.bills", { n: dash.data.bills }), dash.data.gstCollected > 0 ? t("dash.gstNote", { amount: formatINR(dash.data.gstCollected) }) : ""].filter(Boolean).join(" · ")} />
            <Stat label={t("dash.bought")} help={t("dash.boughtHelp")} value={dash.data.bought} />
            <Stat label={t("dash.profit")} help={t("dash.profitHelp")} value={dash.data.profit} tone={dash.data.profit > 0 ? "good" : dash.data.profit < 0 ? "bad" : undefined} />
            <Stat label={t("dash.stockLeft")} help={t("dash.stockLeftHelp")} value={dash.data.stockValue} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title={t("dash.soldItems")} />
              {dash.data.soldItems.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{t("dash.noSales")}</p>
              ) : (
                <ul>
                  {dash.data.soldItems.map((i) => (
                    <li key={`${i.name}-${i.unit}`} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                      <span className="min-w-0 truncate text-base">{i.name}</span>
                      <span className="flex shrink-0 items-baseline gap-4">
                        <span className="num text-sm text-muted">
                          {formatQty(i.qty)} {unit(i.unit)}
                        </span>
                        <Money value={i.amount} className="font-medium" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="space-y-5">
              <Panel>
                <PanelHeader title={t("dash.lowStock")} />
                {products.isPending ? (
                  <TableSkeleton rows={2} cols={2} />
                ) : low.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">{t("dash.lowStockNone")}</p>
                ) : (
                  <ul>
                    {low.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                        <span className="min-w-0 truncate text-base">{p.name}</span>
                        <Badge tone={p.quantity <= 0 ? "bad" : "warn"} className="num shrink-0">
                          {formatQty(p.quantity)} {unit(p.unit)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel>
                <PanelHeader
                  title={t("dash.recentBills")}
                  action={
                    <Link href="/bills" className="link -my-2 inline-flex min-h-10 items-center px-1 text-sm">
                      {t("common.seeAll")}
                    </Link>
                  }
                />
                {bills.isPending ? (
                  <TableSkeleton rows={3} cols={3} />
                ) : (bills.data ?? []).length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">{t("dash.noBills")}</p>
                ) : (
                  <ul>
                    {(bills.data ?? []).map((b) => (
                      <li key={b.id} className="border-b border-line last:border-b-0">
                        <Link href={`/bills/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                          <span className="min-w-0">
                            <span className="num font-medium">{billNumber(b.number)}</span>
                            <span className="ml-2 truncate text-sm text-muted">{b.customerName}</span>
                            <span className="num ml-2 hidden text-xs text-muted sm:inline">{formatDate(b.date)}</span>
                          </span>
                          <Money value={b.total} className={cn("shrink-0 font-medium", b.status === "cancelled" && "text-muted line-through")} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function GettingStarted() {
  const { t } = useI18n();
  const steps: { text: string; href: string }[] = [
    { text: t("dash.step1"), href: "/stock" },
    { text: t("dash.step2"), href: "/stock" },
    { text: t("dash.step3"), href: "/bills/new" },
    { text: t("dash.step4"), href: "/settings" },
  ];
  return (
    <Panel className="mb-5 p-4">
      <h2 className="text-base font-semibold">{t("dash.startTitle")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("dash.startText")}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.text}>
            <Link href={s.href} className="flex items-center gap-3 rounded border border-line px-3 py-2.5 text-base hover:bg-surface-2">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">{i + 1}</span>
              {s.text}
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
