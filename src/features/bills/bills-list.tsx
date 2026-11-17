"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Receipt } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel } from "@/components/ui/surface";
import { EmptyState } from "@/components/states/empty-state";
import { LoadError } from "@/components/states/load-error";
import { TableSkeleton } from "@/components/states/skeletons";
import { useBills } from "@/data/queries";
import { billNumber } from "@/lib/bill";
import { formatDate } from "@/lib/format/date";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BillsList() {
  const { t } = useI18n();
  const bills = useBills();
  const [query, setQuery] = React.useState("");

  const all = bills.data ?? [];
  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter((b) => b.customerName.toLowerCase().includes(q) || b.customerMobile.includes(q.replace(/\s/g, "")) || billNumber(b.number).toLowerCase().includes(q) || String(b.number) === q)
    : all;

  return (
    <>
      <PageHeader
        title={t("bills.title")}
        actions={
          <Link href="/bills/new" className="inline-flex h-11 items-center gap-2 rounded border border-accent bg-accent px-5 text-base font-medium text-accent-ink hover:border-ink hover:bg-ink">
            <Plus size={18} /> {t("nav.newBill")}
          </Link>
        }
      />
      {bills.isPending ? (
        <Panel>
          <TableSkeleton rows={6} cols={4} />
        </Panel>
      ) : bills.isError ? (
        <LoadError error={bills.error} onRetry={() => void bills.refetch()} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState icon={<Receipt size={36} />} title={t("bills.emptyTitle")} reason={t("bills.emptyText")} actionLabel={t("nav.newBill")} actionHref="/bills/new" />
        </Panel>
      ) : (
        <>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("bills.search")}
            aria-label={t("bills.search")}
            className="mb-3 h-11 max-w-md text-base"
          />
          <Panel className="overflow-hidden">
            {shown.length === 0 ? (
              <p role="status" className="px-4 py-10 text-center text-sm text-muted">
                {t("bills.noMatch", { q: query.trim() })}
              </p>
            ) : (
              <ul>
                {shown.map((b) => (
                  <li key={b.id} className="border-b border-line last:border-b-0">
                    <Link href={`/bills/${b.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2 sm:grid-cols-[8rem_7rem_minmax(0,1fr)_auto]">
                      <span className="num font-medium">{billNumber(b.number)}</span>
                      <span className="num order-last col-span-2 text-xs text-muted sm:order-none sm:col-span-1 sm:text-sm">{formatDate(b.date)}</span>
                      <span className={cn("min-w-0 truncate", b.status === "cancelled" && "text-muted line-through")}>
                        {b.customerName || t("bills.walkIn")}
                        {b.customerMobile ? <span className="num ml-2 text-xs text-muted">{b.customerMobile}</span> : null}
                      </span>
                      <span className="flex items-center justify-end gap-2">
                        {b.status === "cancelled" ? <Badge tone="bad">{t("bills.cancelled")}</Badge> : null}
                        <Money value={b.total} className={cn("font-medium", b.status === "cancelled" && "text-muted line-through")} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
