"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel, Skeleton } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/tables/data-table";
import { ErrorState } from "@/components/states/error-state";
import { useBusiness, useDocs, useJournal, useParties } from "@/data/hooks";
import { isInvoiceLike, outstanding, payStatus, type PayStatus } from "@/domain/engine";
import { aging, partyLedger, type LedgerRow } from "@/domain/reports";
import type { Doc } from "@/domain/types";
import { reminderLink } from "@/features/documents/share";
import { TYPE_LABEL, docHref } from "@/features/documents/config";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format/date";
import { stateName } from "@/lib/gst/states";
import { PartyDialog } from "./party-dialog";

export function PartyDetail({ type }: { type: "customer" | "supplier" }) {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const fy = useFy();
  const parties = useParties();
  const journal = useJournal();
  const docs = useDocs(type === "customer" ? "sales" : "purchase");
  const business = useBusiness();
  const [from, setFrom] = React.useState(fy.from);
  const [to, setTo] = React.useState(fy.to);
  const [edit, setEdit] = React.useState(false);
  const mod = type === "customer" ? "sales" : "purchases";
  const base = type === "customer" ? "/sales" : "/purchases";
  const party = parties.data?.find((p) => p.id === id);

  const ledger = React.useMemo(() => (party && journal.data ? partyLedger(party, journal.data, from, to) : undefined), [party, journal.data, from, to]);
  const myDocs = React.useMemo(() => (docs.data ?? []).filter((d) => d.partyId === id).sort((a, b) => b.date.localeCompare(a.date)), [docs.data, id]);
  const buckets = React.useMemo(() => aging(myDocs, type === "customer" ? "sales" : "purchase", fy.today)[0], [myDocs, type, fy.today]);

  if (parties.isPending || journal.isPending) return <Skeleton className="h-96 w-full" />;
  if (parties.error || journal.error) return <ErrorState what="This page could not be loaded" blame="network" onRetry={() => { void parties.refetch(); void journal.refetch(); }} />;
  if (!party || !ledger) return <ErrorState what={`This ${type} does not exist`} blame="input" detail="It may have been deleted." />;

  const balance = partyLedger(party, journal.data ?? []).closing;
  const overdue = (buckets?.d30 ?? 0) + (buckets?.d60 ?? 0) + (buckets?.d90 ?? 0) + (buckets?.over90 ?? 0);
  const wa = party.phone && balance > 0 && business.data ? reminderLink(party.name, party.phone, balance, business.data) : undefined;

  const ledgerCols: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "number", header: "Voucher", cell: ({ getValue }) => <span className="num">{String(getValue())}</span> },
    { accessorKey: "narration", header: "Particulars" },
    { accessorKey: "debit", header: "Debit", meta: { align: "right" }, cell: ({ getValue }) => (Number(getValue()) ? <Money value={Number(getValue())} symbol={false} /> : "") },
    { accessorKey: "credit", header: "Credit", meta: { align: "right" }, cell: ({ getValue }) => (Number(getValue()) ? <Money value={Number(getValue())} symbol={false} /> : "") },
    { accessorKey: "balance", header: "Balance", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} symbol={false} /> },
  ];

  type DocRow = Doc & { st: PayStatus; due: number };
  const docRows: DocRow[] = myDocs.map((d) => ({ ...d, st: payStatus(d, fy.today), due: isInvoiceLike(d.kind, d.type) && d.status === "final" ? outstanding(d) : 0 }));
  const docCols: ColumnDef<DocRow, unknown>[] = [
    { accessorKey: "number", header: "Number", cell: ({ row }) => <Link className="num font-medium hover:underline" href={docHref(row.original.kind, row.original.type, row.original.id)}>{row.original.number}</Link> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => TYPE_LABEL[String(getValue())] },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { id: "total", header: "Total", accessorFn: (r) => r.totals.grandTotal, meta: { align: "right" }, cell: ({ row }) => <Money value={row.original.totals.grandTotal} /> },
    { accessorKey: "due", header: "Balance", meta: { align: "right" }, cell: ({ row }) => (row.original.due ? <Money value={row.original.due} /> : "") },
    { accessorKey: "st", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as PayStatus} /> },
  ];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={party.name}
          description={[party.gstin || "Unregistered", stateName(party.stateCode), party.phone].filter(Boolean).join(" · ")}
          actions={
            <>
              <Link href={base + (type === "customer" ? "/customers" : "/suppliers")} className="link text-sm">All {type}s</Link>
              {can(mod, "create") ? <Link href={`${base}/${type === "customer" ? "invoices" : "bills"}/new?party=${party.id}`} className="inline-flex h-9 items-center rounded border border-accent bg-accent px-3.5 text-sm font-medium text-accent-ink hover:bg-ink hover:border-ink">New {type === "customer" ? "invoice" : "bill"}</Link> : null}
              {can(mod, "create") ? <Link href={`${base}/payments?new=1&party=${party.id}`} className="inline-flex h-9 items-center rounded border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2">Record payment</Link> : null}
              {wa ? <Button onClick={() => window.open(wa, "_blank", "noopener,noreferrer")}>WhatsApp reminder</Button> : null}
              {can(mod, "edit") ? <Button onClick={() => setEdit(true)}>Edit</Button> : null}
            </>
          }
        />
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Panel className="p-4"><p className="text-xs text-muted">{type === "customer" ? "They owe you" : "You owe them"}</p><p className="mt-1 text-lg font-semibold"><Money value={balance} /></p></Panel>
          <Panel className="p-4"><p className="text-xs text-muted">Overdue</p><p className={`mt-1 text-lg font-semibold ${overdue > 0 ? "text-bad" : ""}`}><Money value={overdue} /></p></Panel>
          <Panel className="p-4"><p className="text-xs text-muted">Credit limit</p><p className="mt-1 text-lg font-semibold">{party.creditLimit ? <Money value={party.creditLimit} /> : "None set"}</p>{party.creditLimit > 0 && balance > party.creditLimit ? <p className="mt-1 text-xs text-bad">Over the limit by <Money value={balance - party.creditLimit} /></p> : null}</Panel>
          <Panel className="p-4"><p className="text-xs text-muted">Credit period</p><p className="num mt-1 text-lg font-semibold">{party.creditDays} days</p></Panel>
        </div>
        {buckets ? (
          <Panel className="mb-5 p-4">
            <p className="mb-2 text-xs font-medium text-muted">Aging of open {type === "customer" ? "invoices" : "bills"}</p>
            <div className="grid grid-cols-5 gap-3 text-sm">
              {([["Not due", buckets.current], ["1 to 30", buckets.d30], ["31 to 60", buckets.d60], ["61 to 90", buckets.d90], ["Over 90", buckets.over90]] as const).map(([l, v]) => (
                <div key={l}><p className="text-xs text-muted">{l} days</p><p><Money value={v} /></p></div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>

      <Tabs defaultValue="statement">
        <TabsList className="no-print mb-4"><TabsTrigger value="statement">Statement</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger></TabsList>
        <TabsContent value="statement">
          <div className="no-print mb-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></label>
            <label className="text-xs text-muted">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></label>
            <Button onClick={() => window.print()}>Print statement</Button>
            <Button onClick={() => downloadText(`${party.name}-statement.csv`, toCsv(["Date", "Voucher", "Particulars", "Debit", "Credit", "Balance"], [["", "", "Opening balance", "", "", ledger.opening], ...ledger.rows.map((r) => [r.date, r.number, r.narration, r.debit, r.credit, r.balance])]))}>Export CSV</Button>
          </div>
          <div className="mb-2 hidden print:block"><h2 className="text-lg font-semibold">{party.name}: statement {formatDate(from)} to {formatDate(to)}</h2></div>
          <p className="mb-2 text-sm text-muted">Opening balance <Money value={ledger.opening} /> · Closing balance <Money value={ledger.closing} /></p>
          <DataTable columns={ledgerCols} data={ledger.rows} isLoading={false} noun="entries" rowKey={(r) => r.number + r.date + r.debit + r.credit} empty={{ title: "No entries in this period", reason: "Invoices, payments and adjustments for this party appear here. Widen the dates to see more." }} />
        </TabsContent>
        <TabsContent value="docs">
          <DataTable columns={docCols} data={docRows} isLoading={docs.isPending} error={docs.error} noun="documents" rowKey={(r) => r.id} empty={{ title: "No documents yet", reason: "Invoices, bills, quotations and returns for this party will be listed here." }} />
        </TabsContent>
      </Tabs>
      <PartyDialog open={edit} onOpenChange={setEdit} type={type} party={party} />
    </>
  );
}
