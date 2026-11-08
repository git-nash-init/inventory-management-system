"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/amount";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { useBusiness, useJournal, useParties } from "@/data/hooks";
import { partyBalances } from "@/domain/reports";
import type { Party } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { downloadText, toCsv } from "@/lib/csv";
import { stateName } from "@/lib/gst/states";
import { PartyDialog } from "./party-dialog";

type Row = Party & { balance: number };

export function PartiesPage({ type }: { type: "customer" | "supplier" }) {
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const parties = useParties();
  const journal = useJournal();
  const business = useBusiness();
  const [open, setOpen] = React.useState(params.get("new") === "1");
  const [editing, setEditing] = React.useState<Party>();
  const mod = type === "customer" ? "sales" : "purchases";
  const base = type === "customer" ? "/sales/customers" : "/purchases/suppliers";
  const label = type === "customer" ? "customer" : "supplier";

  const rows = React.useMemo<Row[]>(() => {
    if (!parties.data || !journal.data) return [];
    const bal = partyBalances(parties.data, journal.data);
    return parties.data.filter((p) => p.type === type).map((p) => ({ ...p, balance: bal.get(p.id) ?? 0 }));
  }, [parties.data, journal.data, type]);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => (<div><Link href={`${base}/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.name}</Link>{!row.original.active ? <Badge className="ml-2">Inactive</Badge> : null}<div className="num text-xs text-muted">{row.original.gstin || "Unregistered"}</div></div>) },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="num">{String(getValue() || "-")}</span> },
    { id: "state", header: "State", accessorFn: (r) => stateName(r.stateCode) },
    { accessorKey: "creditDays", header: "Credit", meta: { align: "right" }, cell: ({ getValue }) => `${getValue()} days` },
    {
      accessorKey: "balance", header: type === "customer" ? "They owe you" : "You owe", meta: { align: "right" },
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-end gap-2">
          {type === "customer" && row.original.creditLimit > 0 && row.original.balance > row.original.creditLimit ? <Badge tone="bad">Over limit</Badge> : null}
          <Money value={row.original.balance} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={type === "customer" ? "Customers" : "Suppliers"}
        description={type === "customer" ? "Who you sell to, what they owe and how long they take to pay." : "Who you buy from and what you owe them."}
        actions={
          <>
            <Button onClick={() => downloadText(`${label}s.csv`, toCsv(["Name", "GSTIN", "State", "Phone", "Email", "Balance"], rows.map((r) => [r.name, r.gstin, stateName(r.stateCode), r.phone, r.email, r.balance])))} disabled={!rows.length}>Export CSV</Button>
            {can(mod, "create") ? <Button variant="primary" onClick={() => { setEditing(undefined); setOpen(true); }}>New {label}</Button> : null}
          </>
        }
      />
      <DataTable
        columns={columns} data={rows} isLoading={parties.isPending || journal.isPending} error={parties.error ?? journal.error} onRetry={() => { void parties.refetch(); void journal.refetch(); }}
        noun={`${label}s`} searchKeys={["name", "gstin", "phone"]} searchLabel={`Search by name, GSTIN or phone`} rowKey={(r) => r.id} initialSort={[{ id: "name", desc: false }]}
        onRowClick={(r) => router.push(`${base}/${r.id}`)}
        onCreateFromQuery={can(mod, "create") ? () => { setEditing(undefined); setOpen(true); } : undefined}
        empty={{ title: `No ${label}s yet`, reason: type === "customer" ? "Add a customer to bill them, track what they owe and send payment reminders." : "Add a supplier to record their bills and track what you owe.", icon: <Users size={28} />, actionLabel: can(mod, "create") ? `Add your first ${label}` : undefined, onAction: () => setOpen(true) }}
      />
      <PartyDialog key={editing?.id ?? "new"} open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(undefined); if (params.get("new")) router.replace(base); } }} type={type} party={editing} defaultState={business.data?.stateCode} />
    </>
  );
}
