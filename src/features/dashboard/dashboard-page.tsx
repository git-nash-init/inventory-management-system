"use client";

import * as React from "react";
import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/surface";
import { LoadError } from "@/components/states/load-error";
import { StatSkeleton, TableSkeleton } from "@/components/states/skeletons";
import { useBills, useDashboard, useProducts } from "@/data/queries";
import { billNumber, monthStart } from "@/lib/bill";
import { formatDate, formatMonth } from "@/lib/format/date";
import { formatINR, formatQty } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function Stat({ label, help, value, note, tone }: { label: string; help: string; value: number; note?: string; tone?: "good" | "bad" }) {
  return (
    <Panel className="p-4">
      <div className="text-sm font-medium">{label}</div>
      <Money value={value} className={cn("mt-1 block text-2xl font-semibold", tone === "good" && "text-ok", tone === "bad" && "text-bad")} />
      <p className="mt-2 text-xs text-muted">{help}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </Panel>
  );
}

export function DashboardPage() {
  const { t, unit } = useI18n();
  const [offset, setOffset] = React.useState(0);
  const month = React.useMemo(() => monthStart(offset), [offset]);
  const dash = useDashboard(month);
  const products = useProducts();
  const bills = useBills(5);

  const low = (products.data ?? []).filter((p) => p.lowStockAt !== null && p.quantity <= p.lowStockAt);
  const brandNew = products.isSuccess && products.data.length === 0 && bills.isSuccess && bills.data.length === 0;

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        actions={
          <div className="flex items-center gap-1">
            <Button size="icon" className="h-11 w-11" aria-label={t("dash.monthPrev")} title={t("dash.monthPrev")} onClick={() => setOffset((o) => o - 1)}>
              <CaretLeft size={18} />
            </Button>
            <span className="min-w-36 text-center text-base font-medium" suppressHydrationWarning>
              {formatMonth(month)}
            </span>
            <Button size="icon" className="h-11 w-11" aria-label={t("dash.monthNext")} title={t("dash.monthNext")} disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}>
              <CaretRight size={18} />
            </Button>
          </div>
        }
      />

      {brandNew ? <GettingStarted /> : null}

      {dash.isPending ? (
        <StatSkeleton />
      ) : dash.isError ? (
        <LoadError error={dash.error} onRetry={() => void dash.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    <Link href="/bills" className="link text-sm">
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
