"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel, Skeleton } from "@/components/ui/surface";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { getRepo } from "@/data";
import { errorMessage, useAccounts, useJournal, useRepoMutation } from "@/data/hooks";
import { accountBook } from "@/domain/reports";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format/date";
import { round2 } from "@/lib/format/money";

export function BooksPage({ mode }: { mode: "cash" | "bank" | "ledger" }) {
  const params = useParams<{ id?: string }>();
  const { can } = useAuth();
  const fy = useFy();
  const accounts = useAccounts();
  const journal = useJournal();
  const [from, setFrom] = React.useState(fy.from);
  const [to, setTo] = React.useState(fy.to);
  const [pick, setPick] = React.useState("");
  const [reconcile, setReconcile] = React.useState(false);
  const [stmt, setStmt] = React.useState("");
  const [stmtDate, setStmtDate] = React.useState(fy.today);
  const clear = useRepoMutation((a: { entryId: string; accountId: string; date: string | null }) => getRepo().journal.setCleared(a.entryId, a.accountId, a.date));

  const candidates = (accounts.data ?? []).filter((a) => (mode === "cash" ? a.group === "Cash in Hand" : mode === "bank" ? a.group === "Bank Accounts" : a.id === params.id));
  const account = candidates.find((a) => a.id === pick) ?? candidates[0];
  const title = mode === "cash" ? "Cash book" : mode === "bank" ? "Bank book" : account?.name ?? "Ledger";

  const book = account && journal.data && accounts.data ? accountBook(account, accounts.data, journal.data, from, to) : undefined;
  const entryByKey = new Map((journal.data ?? []).map((e) => [e.number + e.date, e]));

  if (accounts.isPending || journal.isPending) return <div aria-busy="true"><Skeleton className="mb-3 h-8 w-48" /><Skeleton className="h-80 w-full" /></div>;
  if (accounts.error || journal.error) return <ErrorState what={`${title} could not be loaded`} blame="network" onRetry={() => { void accounts.refetch(); void journal.refetch(); }} />;
  if (!account || !book) return <EmptyState title="No account found" reason={mode === "ledger" ? "This account does not exist." : "Add a cash or bank account under Accounting, Chart of accounts."} />;

  const cleared = (r: { number: string; date: string }) => entryByKey.get(r.number + r.date)?.cleared?.[account.id];
  const clearedBalance = round2(book.opening + book.rows.filter((r) => cleared(r)).reduce((a, r) => a + r.debit - r.credit, 0));
  const diff = stmt === "" ? undefined : round2(Number(stmt) - clearedBalance);

  async function toggle(r: { number: string; date: string }) {
    const e = entryByKey.get(r.number + r.date);
    if (!e) return;
    try {
      await clear.mutateAsync({ entryId: e.id, accountId: account!.id, date: cleared(r) ? null : stmtDate });
    } catch (err) {
      toast.error(errorMessage(err).message);
    }
  }

  return (
    <>
      <div className="no-print">
        <PageHeader title={title} description={mode === "ledger" ? `${account.code} · ${account.group}` : "Every receipt and payment with a running balance."} actions={<><Button onClick={() => window.print()}>Print</Button><Button onClick={() => downloadText(`${title}.csv`, toCsv(["Date", "Voucher", "Particulars", "Against", "Debit", "Credit", "Balance"], [["", "", "Opening balance", "", "", "", book.opening], ...book.rows.map((r) => [r.date, r.number, r.narration, r.against, r.debit, r.credit, r.balance])]))}>Export CSV</Button></>} />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {mode !== "ledger" && candidates.length > 1 ? <label className="text-xs text-muted">Account<NativeSelect value={account.id} onChange={(e) => setPick(e.target.value)} className="mt-1 w-56">{candidates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></label> : null}
          <label className="text-xs text-muted">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></label>
          <label className="text-xs text-muted">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></label>
          {mode === "bank" && can("accounting", "edit") ? <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={reconcile} onChange={(e) => setReconcile(e.target.checked)} /> Reconcile with bank statement</label> : null}
        </div>
        {reconcile ? (
          <Panel className="mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs text-muted">Statement date<Input type="date" value={stmtDate} onChange={(e) => setStmtDate(e.target.value)} className="mt-1" /></label>
              <label className="text-xs text-muted">Closing balance on statement<Input type="number" step="any" value={stmt} onChange={(e) => setStmt(e.target.value)} className="num mt-1 text-right" /></label>
              <div className="text-sm"><p className="text-xs text-muted">Cleared balance in books</p><p className="mt-2 text-base font-semibold"><Money value={clearedBalance} /></p></div>
              <div className="text-sm"><p className="text-xs text-muted">Difference</p><p className={`mt-2 text-base font-semibold ${diff === undefined ? "" : diff === 0 ? "text-ok" : "text-bad"}`}>{diff === undefined ? "Enter statement balance" : diff === 0 ? "Reconciled" : <Money value={diff} />}</p></div>
            </div>
            <p className="mt-2 text-xs text-muted">Tick each line that appears on the bank statement. When the difference is zero, the book matches the bank.</p>
          </Panel>
        ) : null}
      </div>
      <h2 className="mb-2 hidden text-lg font-semibold print:block">{title}: {formatDate(from)} to {formatDate(to)}</h2>
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">{reconcile ? <th className="w-10 px-3 py-2">Cleared</th> : null}<th className="px-3 py-2">Date</th><th className="px-3 py-2">Voucher</th><th className="px-3 py-2">Particulars</th><th className="px-3 py-2">Against</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
          <tbody>
            <tr className="border-b border-line bg-surface-2/50"><td colSpan={reconcile ? 7 : 6} className="px-3 py-2 font-medium">Opening balance</td><td className="px-3 py-2 text-right"><Money value={book.opening} symbol={false} /></td></tr>
            {book.rows.length === 0 ? <tr><td colSpan={reconcile ? 8 : 7} className="px-3 py-10 text-center text-muted">No entries in this period. Widen the dates to see more.</td></tr> : null}
            {book.rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {reconcile ? <td className="px-3 py-2"><input type="checkbox" aria-label={`Cleared: ${r.number}`} checked={Boolean(cleared(r))} onChange={() => void toggle(r)} /></td> : null}
                <td className="num px-3 py-2">{formatDate(r.date)}</td><td className="num px-3 py-2">{r.number}</td><td className="px-3 py-2">{r.narration}</td><td className="px-3 py-2 text-muted">{r.against}</td>
                <td className="px-3 py-2 text-right">{r.debit ? <Money value={r.debit} symbol={false} /> : ""}</td><td className="px-3 py-2 text-right">{r.credit ? <Money value={r.credit} symbol={false} /> : ""}</td><td className="px-3 py-2 text-right"><Money value={r.balance} symbol={false} /></td>
              </tr>
            ))}
            <tr className="bg-surface-2/50 font-medium"><td colSpan={reconcile ? 7 : 6} className="px-3 py-2">Closing balance</td><td className="px-3 py-2 text-right"><Money value={book.closing} symbol={false} /></td></tr>
          </tbody>
        </table>
      </Panel>
    </>
  );
}
