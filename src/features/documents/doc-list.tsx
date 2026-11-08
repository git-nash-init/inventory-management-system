"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/amount";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { useDocs } from "@/data/hooks";
import { payStatus, outstanding, isInvoiceLike, type PayStatus } from "@/domain/engine";
import type { Doc } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { formatDate } from "@/lib/format/date";
import { listQueuedDrafts } from "@/lib/drafts";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { TYPE_LABEL, basePath, docHref, type DocRoute } from "./config";

type Row = Doc & { status2: PayStatus; due: number };

function QueuedDrafts({ route }: { route: DocRoute }) {
  const online = useOnlineStatus();
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    void listQueuedDrafts().then((q) => alive && setN(q.filter((x) => x.key.startsWith(`doc:${route.kind}:`) && route.types.some((t) => x.key.startsWith(`doc:${route.kind}:${t}:`))).length));
    return () => {
      alive = false;
    };
  }, [route, online]);
  if (!n) return null;
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded border border-warn/40 bg-warn-bg px-3 py-2 text-sm text-warn">
      <span>{n} {n === 1 ? "document is" : "documents are"} saved on this device and not submitted yet.{online ? "" : " Submit when you are back online."}</span>
      <Link className="link" href={`${basePath(route.kind)}/${route.segment}/new`}>Open and submit</Link>
    </div>
  );
}

export function DocList({ route }: { route: DocRoute }) {
  const router = useRouter();
  const { can } = useAuth();
  const fy = useFy();
  const q = useDocs(route.kind);
  const [status, setStatus] = React.useState("");
  const mod = route.kind === "sales" ? "sales" : "purchases";

  const rows = React.useMemo<Row[]>(() => {
    return (q.data ?? [])
      .filter((d) => route.types.includes(d.type) && (d.status === "draft" || (d.date >= fy.from && d.date <= fy.to)))
      .map((d) => ({ ...d, status2: payStatus(d, fy.today), due: isInvoiceLike(d.kind, d.type) && d.status === "final" ? outstanding(d) : 0 }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [q.data, route.types, fy]);

  const filtered = status ? rows.filter((r) => r.status2 === status) : rows;
  const multiType = route.types.length > 1 || route.segment === "invoices";

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "number", header: "Number", cell: ({ row }) => (<div><Link href={docHref(row.original.kind, row.original.type, row.original.id)} className="num font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.number}</Link>{multiType ? <div className="text-xs text-muted">{TYPE_LABEL[row.original.type]}</div> : null}</div>) },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "partyName", header: route.partyLabel },
    { id: "total", header: "Total", accessorFn: (r) => r.totals.grandTotal, meta: { align: "right" }, cell: ({ row }) => <Money value={row.original.totals.grandTotal} /> },
    { accessorKey: "due", header: "Balance", meta: { align: "right" }, cell: ({ row }) => (row.original.due > 0 ? <Money value={row.original.due} /> : <span className="text-muted">-</span>) },
    { accessorKey: "dueDate", header: "Due on", cell: ({ row }) => (row.original.dueDate && row.original.due > 0 ? <span className="num">{formatDate(row.original.dueDate)}</span> : <span className="text-muted">-</span>) },
    { accessorKey: "status2", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as PayStatus} /> },
  ];

  const statuses: PayStatus[] = route.types.some((t) => ["invoice", "bill"].includes(t)) ? ["draft", "unpaid", "partial", "paid", "overdue", "cancelled"] : ["draft", "open", "converted", "cancelled"];

  return (
    <>
      <PageHeader
        title={route.title}
        description={`${route.description} Showing FY ${fy.label}.`}
        actions={can(mod, "create") ? <Link href={`${basePath(route.kind)}/${route.segment}/new`} className="inline-flex h-9 items-center rounded border border-accent bg-accent px-3.5 text-sm font-medium text-accent-ink hover:bg-ink hover:border-ink">New {route.singular}</Link> : undefined}
      />
      <QueuedDrafts route={route} />
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        noun={route.title.toLowerCase()}
        searchKeys={["number", "partyName", "supplierInvoiceNo"]}
        searchLabel={`Search by number or ${route.partyLabel.toLowerCase()}`}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(docHref(r.kind, r.type, r.id))}
        initialSort={[{ id: "date", desc: true }]}
        activeFilters={status ? 1 : 0}
        onClearFilters={() => setStatus("")}
        empty={{
          title: `No ${route.title.toLowerCase()} yet`,
          reason: rows.length === 0 && (q.data ?? []).some((d) => route.types.includes(d.type)) ? `Nothing was dated in FY ${fy.label}. Change the financial year at the top to see earlier records.` : route.emptyReason,
          icon: <FileText size={28} />,
          actionLabel: can(mod, "create") ? `Create ${route.singular}` : undefined,
          actionHref: `${basePath(route.kind)}/${route.segment}/new`,
        }}
        filters={
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </NativeSelect>
        }
        toolbar={<Button onClick={() => void q.refetch()} disabled={q.isFetching}>{q.isFetching ? "Refreshing" : "Refresh"}</Button>}
      />
    </>
  );
}
