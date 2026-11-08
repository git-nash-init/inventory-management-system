"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel, Skeleton } from "@/components/ui/surface";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { useAccounts, useJournal } from "@/data/hooks";
import { dayBook } from "@/domain/reports";
import { useFy } from "@/lib/fy";
import { formatDate } from "@/lib/format/date";
import { round2 } from "@/lib/format/money";

export function DayBookPage() {
  const fy = useFy();
  const journal = useJournal();
  const accounts = useAccounts();
  const [date, setDate] = React.useState(fy.today);
  const entries = React.useMemo(() => (journal.data ? dayBook(journal.data, date) : []), [journal.data, date]);

  if (journal.isPending || accounts.isPending) return <Skeleton className="h-80 w-full" />;
  if (journal.error) return <ErrorState what="The day book could not be loaded" blame="network" onRetry={() => void journal.refetch()} />;

  const name = (id: string) => accounts.data?.find((a) => a.id === id)?.name ?? id;
  return (
    <>
      <div className="no-print">
        <PageHeader title="Day book" description="Every entry posted on a single day." actions={<Button onClick={() => window.print()}>Print</Button>} />
        <div className="mb-4 flex gap-2">
          <label className="text-xs text-muted">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-44" /></label>
          <Button className="self-end" onClick={() => setDate(fy.today)}>Today</Button>
        </div>
      </div>
      <h2 className="mb-2 hidden text-lg font-semibold print:block">Day book {formatDate(date)}</h2>
      {entries.length === 0 ? (
        <Panel><EmptyState title={`Nothing was posted on ${formatDate(date)}`} reason="Pick another date, or record a sale, purchase or payment." /></Panel>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Panel key={e.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-sm"><span><span className="num font-medium">{e.number}</span> · {e.voucherType.replace("_", " ")}</span><span className="text-muted">{e.narration}</span></div>
              <table className="w-full text-sm"><tbody>
                {e.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line last:border-0"><td className="px-4 py-1.5">{l.credit ? <span className="pl-6">{name(l.accountId)}</span> : name(l.accountId)}</td><td className="w-32 px-4 py-1.5 text-right">{l.debit ? <Money value={l.debit} symbol={false} /> : ""}</td><td className="w-32 px-4 py-1.5 text-right">{l.credit ? <Money value={l.credit} symbol={false} /> : ""}</td></tr>
                ))}
              </tbody></table>
            </Panel>
          ))}
          <p className="text-sm text-muted">Total debits <Money value={round2(entries.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.debit, 0), 0))} /></p>
        </div>
      )}
    </>
  );
}
