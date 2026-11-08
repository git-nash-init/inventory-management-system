"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { getRepo } from "@/data";
import { errorMessage, useAccounts, useJournal, useParties, useRepoMutation } from "@/data/hooks";
import type { JournalEntry, VoucherInput } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { formatDate, toISODate } from "@/lib/format/date";
import { round2, toPaise } from "@/lib/format/money";

type VType = VoucherInput["voucherType"];
const TYPES: { value: VType; label: string; hint: string }[] = [
  { value: "receipt", label: "Receipt", hint: "Money coming in. Debit cash or bank, credit the source." },
  { value: "payment", label: "Payment", hint: "Money going out. Debit the expense or party, credit cash or bank." },
  { value: "contra", label: "Contra", hint: "Move money between cash and bank." },
  { value: "journal", label: "Journal", hint: "Any adjustment. Total debits must equal total credits." },
];
type L = { key: string; accountId: string; partyId: string; debit: string; credit: string };
const blankLine = (): L => ({ key: crypto.randomUUID(), accountId: "", partyId: "", debit: "", credit: "" });

function VoucherDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useAccounts();
  const parties = useParties();
  const [type, setType] = React.useState<VType>("journal");
  const [date, setDate] = React.useState(toISODate(new Date()));
  const [narration, setNarration] = React.useState("");
  const [lines, setLines] = React.useState<L[]>([blankLine(), blankLine()]);
  const [error, setError] = React.useState<string>();
  const save = useRepoMutation((v: VoucherInput) => getRepo().journal.createVoucher(v));

  const dr = round2(lines.reduce((a, l) => a + (Number(l.debit) || 0), 0));
  const cr = round2(lines.reduce((a, l) => a + (Number(l.credit) || 0), 0));
  const diff = round2(dr - cr);
  const patch = (key: string, p: Partial<L>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const partyAccounts = new Set(["acc-debtors", "acc-creditors"]);

  async function submit() {
    setError(undefined);
    if (!narration.trim()) return setError("Enter a narration, for example what this entry is for.");
    const used = lines.filter((l) => Number(l.debit) || Number(l.credit));
    if (used.length < 2) return setError("Enter at least two lines with an amount.");
    if (used.some((l) => !l.accountId)) return setError("Choose an account on every line that has an amount.");
    if (used.some((l) => Number(l.debit) && Number(l.credit))) return setError("A line cannot have both a debit and a credit.");
    if (toPaise(dr) !== toPaise(cr)) return setError(`Debits and credits must match. They differ by ${Math.abs(diff)}.`);
    try {
      await save.mutateAsync({ date, voucherType: type, narration, lines: used.map((l) => ({ accountId: l.accountId, partyId: l.partyId || undefined, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) });
      toast.success("Voucher posted");
      setNarration("");
      setLines([blankLine(), blankLine()]);
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New voucher" description={TYPES.find((t) => t.value === type)?.hint} className="max-w-3xl">
        <div className="space-y-3">
          {error ? <p role="alert" className="rounded border border-bad/40 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type" htmlFor="vt"><NativeSelect id="vt" value={type} onChange={(e) => setType(e.target.value as VType)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect></Field>
            <Field label="Date" htmlFor="vd" required><Input id="vd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Narration" htmlFor="vn" required><Input id="vn" value={narration} onChange={(e) => setNarration(e.target.value)} /></Field>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Account</th><th className="py-1">Party (for debtors and creditors)</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right">Credit</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.key}>
                  <td className="pr-2 py-1"><NativeSelect aria-label={`Account for line ${i + 1}`} value={l.accountId} onChange={(e) => patch(l.key, { accountId: e.target.value, partyId: "" })}><option value="">Choose</option>{accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</NativeSelect></td>
                  <td className="pr-2 py-1">{partyAccounts.has(l.accountId) ? <NativeSelect aria-label={`Party for line ${i + 1}`} value={l.partyId} onChange={(e) => patch(l.key, { partyId: e.target.value })}><option value="">Choose</option>{parties.data?.filter((p) => (l.accountId === "acc-debtors" ? p.type === "customer" : p.type === "supplier")).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect> : null}</td>
                  <td className="pr-2 py-1"><Input aria-label={`Debit for line ${i + 1}`} type="number" step="any" min="0" className="num text-right" value={l.debit} onChange={(e) => patch(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                  <td className="pr-2 py-1"><Input aria-label={`Credit for line ${i + 1}`} type="number" step="any" min="0" className="num text-right" value={l.credit} onChange={(e) => patch(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                  <td><button type="button" aria-label={`Remove line ${i + 1}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-bad" onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((x) => x.key !== l.key) : ls))}><Trash size={15} /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-line text-sm"><td colSpan={2} className="py-2"><button type="button" className="link inline-flex items-center gap-1" onClick={() => setLines((ls) => [...ls, blankLine()])}><Plus size={13} /> Add line</button></td><td className="num py-2 text-right"><Money value={dr} symbol={false} /></td><td className="num py-2 text-right"><Money value={cr} symbol={false} /></td><td /></tr></tfoot>
          </table>
          {diff !== 0 ? <p className="text-xs text-warn">Out of balance by {Math.abs(diff)}. {diff > 0 ? "Add a credit." : "Add a debit."}</p> : <p className="text-xs text-ok">Balanced.</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-3"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? "Posting" : "Post voucher"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VouchersPage() {
  const { can } = useAuth();
  const journal = useJournal();
  const accounts = useAccounts();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState("");
  const rows = (journal.data ?? []).filter((e) => !type || e.voucherType === type).slice().reverse();
  const total = (e: JournalEntry) => round2(e.lines.reduce((a, l) => a + l.debit, 0));
  const columns: ColumnDef<JournalEntry, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="num">{String(getValue())}</span> },
    { accessorKey: "voucherType", header: "Type", cell: ({ getValue }) => String(getValue()).replace("_", " ") },
    { accessorKey: "narration", header: "Narration" },
    { id: "acc", header: "Accounts", enableSorting: false, accessorFn: (e) => [...new Set(e.lines.map((l) => accounts.data?.find((a) => a.id === l.accountId)?.name ?? ""))].join(", ") },
    { id: "amt", header: "Amount", meta: { align: "right" }, accessorFn: total, cell: ({ row }) => <Money value={total(row.original)} /> },
  ];
  return (
    <>
      <PageHeader title="Vouchers" description="Every posted entry. Sales, purchases and payments appear here too." actions={can("accounting", "create") ? <Button variant="primary" onClick={() => setOpen(true)}>New voucher</Button> : undefined} />
      <DataTable columns={columns} data={rows} isLoading={journal.isPending} error={journal.error} onRetry={() => void journal.refetch()} noun="vouchers" searchKeys={["number", "narration"]} rowKey={(r) => r.id} initialSort={[{ id: "date", desc: true }]}
        activeFilters={type ? 1 : 0} onClearFilters={() => setType("")}
        filters={<NativeSelect aria-label="Voucher type" value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-44"><option value="">All types</option>{["sales", "purchase", "receipt", "payment", "contra", "journal", "expense", "stock_adjustment", "credit_note", "debit_note", "opening"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</NativeSelect>}
        empty={{ title: "No vouchers yet", reason: "Every sale, purchase, payment and expense posts a voucher. You can also post receipts, payments, contra and journal entries by hand.", actionLabel: can("accounting", "create") ? "New voucher" : undefined, onAction: () => setOpen(true) }} />
      <VoucherDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
