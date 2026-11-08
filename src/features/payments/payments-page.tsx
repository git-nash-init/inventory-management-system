"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Coins } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { SuccessPanel } from "@/components/states/success-panel";
import { getRepo } from "@/data";
import { errorMessage, useAccounts, useDocs, useParties, usePayments, useRepoMutation } from "@/data/hooks";
import { isInvoiceLike, outstanding } from "@/domain/engine";
import type { Payment, PaymentInput, PaymentMode } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { formatDate, toISODate } from "@/lib/format/date";
import { round2 } from "@/lib/format/money";
import { paymentSchema } from "@/lib/validation/entities";

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

function RecordDialog({ direction, open, onOpenChange, presetParty, presetDoc }: { direction: "in" | "out"; open: boolean; onOpenChange: (o: boolean) => void; presetParty?: string; presetDoc?: string }) {
  const kind = direction === "in" ? "sales" : "purchase";
  const parties = useParties();
  const accounts = useAccounts();
  const docs = useDocs(kind);
  const [partyTouched, setPartyTouched] = React.useState<string | undefined>();
  const [date, setDate] = React.useState(toISODate(new Date()));
  const [amountTouched, setAmountTouched] = React.useState<string | undefined>();
  const [allocTouched, setAllocTouched] = React.useState<Record<string, string> | undefined>();
  const [mode, setMode] = React.useState<PaymentMode>("bank");
  const [accountId, setAccountId] = React.useState("acc-bank");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState<Payment>();
  const record = useRepoMutation((i: PaymentInput) => getRepo().payments.record(i));

  // Defaults come from the document the dialog was opened for, until the user edits them.
  const presetDocObj = presetDoc ? docs.data?.find((x) => x.id === presetDoc) : undefined;
  const partyId = partyTouched ?? presetParty ?? presetDocObj?.partyId ?? "";
  const amount = amountTouched ?? (presetDocObj ? String(outstanding(presetDocObj)) : "");
  const alloc = allocTouched ?? (presetDocObj ? { [presetDocObj.id]: String(outstanding(presetDocObj)) } : {});
  const setPartyId = (v: string) => setPartyTouched(v);
  const setAmount = (v: string) => setAmountTouched(v);
  const setAlloc = (v: Record<string, string> | ((a: Record<string, string>) => Record<string, string>)) => setAllocTouched(typeof v === "function" ? v(alloc) : v);

  const open_ = React.useMemo(
    () => (docs.data ?? []).filter((d) => d.partyId === partyId && d.status === "final" && isInvoiceLike(d.kind, d.type) && outstanding(d) > 0.005).sort((a, b) => a.date.localeCompare(b.date)),
    [docs.data, partyId],
  );

  const amt = Number(amount) || 0;
  const allocated = round2(Object.values(alloc).reduce((a, v) => a + (Number(v) || 0), 0));
  const unallocated = round2(amt - allocated);

  function autoAllocate() {
    let left = amt;
    const next: Record<string, string> = {};
    for (const d of open_) {
      if (left <= 0.004) break;
      const take = Math.min(left, outstanding(d));
      next[d.id] = String(round2(take));
      left = round2(left - take);
    }
    setAlloc(next);
  }

  function pickMode(m: PaymentMode) {
    setMode(m);
    const cash = accounts.data?.find((a) => a.group === "Cash in Hand");
    const bank = accounts.data?.find((a) => a.group === "Bank Accounts");
    setAccountId((m === "cash" ? cash : bank)?.id ?? accountId);
  }

  async function submit() {
    const parsed = paymentSchema.safeParse({ date, partyId, amount: Number(amount), mode, accountId, reference, notes });
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
    if (allocated > amt + 0.004) e.allocations = "Allocated amount is more than the payment amount";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const p = await record.mutateAsync({
        direction, date, partyId, amount: amt, mode, reference, accountId, notes,
        allocations: Object.entries(alloc).map(([docId, v]) => ({ docId, amount: Number(v) || 0 })).filter((a) => a.amount > 0),
      });
      setDone(p);
      toast.success(`${p.number} recorded`);
    } catch (err) {
      const m = errorMessage(err);
      setErrors({ [m.field ?? "form"]: m.message });
    }
  }

  const list = (parties.data ?? []).filter((p) => p.type === (direction === "in" ? "customer" : "supplier") && p.active);
  const cashBank = (accounts.data ?? []).filter((a) => a.group === "Cash in Hand" || a.group === "Bank Accounts");

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDone(undefined); }}>
      <DialogContent title={direction === "in" ? "Record payment received" : "Record payment made"} description="Apply the money to one or more invoices, or leave it on account." className="max-w-2xl">
        {done ? (
          <SuccessPanel title={`${done.number} recorded`} detail={`${done.partyName} · ${done.mode} · allocated to ${done.allocations.length} ${done.allocations.length === 1 ? "document" : "documents"}`} steps={[
            { label: "Record another", onClick: () => { setDone(undefined); setAmount(""); setAlloc({}); } },
            { label: "Close", onClick: () => onOpenChange(false) },
          ]} />
        ) : (
          <div className="space-y-3">
            {errors.form ? <p role="alert" className="rounded border border-bad/40 bg-bad-bg px-3 py-2 text-sm text-bad">{errors.form}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={direction === "in" ? "Customer" : "Supplier"} htmlFor="pparty" error={errors.partyId} required>
                <NativeSelect id="pparty" value={partyId} onChange={(e) => { setPartyId(e.target.value); setAlloc({}); }} aria-invalid={Boolean(errors.partyId)}>
                  <option value="">Choose</option>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Date" htmlFor="pdate" error={errors.date} required><Input id="pdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Amount" htmlFor="pamt" error={errors.amount} required><Input id="pamt" type="number" step="any" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} /></Field>
              <Field label="Mode" htmlFor="pmode"><NativeSelect id="pmode" value={mode} onChange={(e) => pickMode(e.target.value as PaymentMode)}>{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</NativeSelect></Field>
              <Field label={direction === "in" ? "Deposited to" : "Paid from"} htmlFor="pacc" error={errors.accountId}><NativeSelect id="pacc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{cashBank.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
              <Field label="Reference (UTR, cheque no.)" htmlFor="pref"><Input id="pref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            </div>
            {partyId ? (
              <div className="rounded border border-line">
                <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2 text-xs">
                  <span className="font-medium">Open {direction === "in" ? "invoices" : "bills"}</span>
                  <button type="button" className="link" onClick={autoAllocate} disabled={!amt}>Apply to oldest first</button>
                </div>
                {open_.length === 0 ? <p className="p-3 text-sm text-muted">Nothing is outstanding for this party. The amount will be kept on account.</p> : (
                  <table className="w-full text-sm"><tbody>
                    {open_.map((d) => (
                      <tr key={d.id} className="border-b border-line last:border-0">
                        <td className="num px-3 py-2">{d.supplierInvoiceNo ? `${d.number} (${d.supplierInvoiceNo})` : d.number}</td>
                        <td className="num px-3 py-2 text-muted">{formatDate(d.date)}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted">Due <Money value={outstanding(d)} /></td>
                        <td className="px-3 py-1.5 text-right"><Input aria-label={`Amount applied to ${d.number}`} type="number" step="any" className="num h-8 w-28 text-right" value={alloc[d.id] ?? ""} onChange={(e) => setAlloc((a) => ({ ...a, [d.id]: e.target.value }))} /></td>
                      </tr>
                    ))}
                  </tbody></table>
                )}
                {errors.allocations ? <p role="alert" className="px-3 pb-2 text-xs text-bad">{errors.allocations}</p> : null}
                <div className="flex justify-between border-t border-line px-3 py-2 text-xs text-muted"><span>Applied <Money value={allocated} /></span><span>On account <Money value={Math.max(0, unallocated)} /></span></div>
              </div>
            ) : null}
            <Field label="Notes" htmlFor="pnotes"><Input id="pnotes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void submit()} disabled={record.isPending}>{record.isPending ? "Saving" : "Save payment"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsPage({ direction }: { direction: "in" | "out" }) {
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const q = usePayments();
  const [open, setOpen] = React.useState(params.get("new") === "1");
  const mod = direction === "in" ? "sales" : "purchases";
  const rows = (q.data ?? []).filter((p) => p.direction === direction).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const columns: ColumnDef<Payment, unknown>[] = [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="num font-medium">{String(getValue())}</span> },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "partyName", header: direction === "in" ? "Customer" : "Supplier" },
    { accessorKey: "mode", header: "Mode", cell: ({ getValue }) => MODES.find((m) => m.value === getValue())?.label ?? String(getValue()) },
    { accessorKey: "reference", header: "Reference", cell: ({ getValue }) => <span className="num">{String(getValue() || "-")}</span> },
    { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
  ];
  return (
    <>
      <PageHeader title={direction === "in" ? "Payments received" : "Payments made"} description={direction === "in" ? "Money collected from customers, applied to invoices." : "Money paid to suppliers, applied to bills."} actions={can(mod, "create") ? <Button variant="primary" onClick={() => setOpen(true)}>Record payment</Button> : undefined} />
      <DataTable columns={columns} data={rows} isLoading={q.isPending} error={q.error} onRetry={() => void q.refetch()} noun="payments" searchKeys={["number", "partyName", "reference"]} rowKey={(r) => r.id} initialSort={[{ id: "date", desc: true }]}
        empty={{ title: "No payments yet", reason: direction === "in" ? "When a customer pays, record it here and apply it to their invoices. Their balance and aging update straight away." : "When you pay a supplier, record it here and apply it to their bills.", icon: <Coins size={28} />, actionLabel: can(mod, "create") ? "Record a payment" : undefined, onAction: () => setOpen(true) }} />
      <RecordDialog key={String(open)} direction={direction} open={open} onOpenChange={(o) => { setOpen(o); if (!o && params.get("new")) router.replace(direction === "in" ? "/sales/payments" : "/purchases/payments"); }} presetParty={params.get("party") ?? undefined} presetDoc={params.get("doc") ?? undefined} />
      <p className="mt-3 text-xs text-muted"><Link className="link" href={direction === "in" ? "/sales/customers" : "/purchases/suppliers"}>See balances by {direction === "in" ? "customer" : "supplier"}</Link></p>
    </>
  );
}
