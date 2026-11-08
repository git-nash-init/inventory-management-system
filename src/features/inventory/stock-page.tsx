"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/amount";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { useMovements, useProducts, useWarehouses } from "@/data/hooks";
import { expiringBatches, fifoValues, stockSummary, type StockRow } from "@/domain/reports";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format/date";
import { formatQty, round2 } from "@/lib/format/money";
import { useFy } from "@/lib/fy";
import { useLiteMode } from "@/components/states/lite-mode";

type Row = StockRow & { id: string; name: string; fifo: number; suggest: number };

export function StockPage() {
  const products = useProducts();
  const movements = useMovements();
  const warehouses = useWarehouses();
  const fy = useFy();
  const { lite } = useLiteMode();
  const [wh, setWh] = React.useState("");

  const rows = React.useMemo<Row[]>(() => {
    if (!products.data || !movements.data) return [];
    const fifo = fifoValues(movements.data);
    return stockSummary(products.data, movements.data, wh || undefined).map((r) => {
      const v = r.variantId ? r.product.variants.find((x) => x.id === r.variantId)?.name : "";
      // Reorder suggestion: bring stock back to twice the reorder level.
      const suggest = r.low ? Math.max(0, Math.ceil(r.product.reorderLevel * 2 - r.qty)) : 0;
      const fifoTotal = fifo.get(`${r.product.id}|${r.variantId ?? ""}`) ?? 0;
      return { ...r, id: `${r.product.id}|${r.variantId ?? ""}`, name: v ? `${r.product.name} (${v})` : r.product.name, fifo: wh ? r.value : fifoTotal, suggest };
    });
  }, [products.data, movements.data, wh]);

  const expiring = React.useMemo(() => (products.data && movements.data ? expiringBatches(movements.data, products.data, 60, fy.today) : []), [products.data, movements.data, fy.today]);
  const total = round2(rows.reduce((s, r) => s + r.value, 0));
  const lowCount = rows.filter((r) => r.low).length;

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "name", header: "Product", cell: ({ row }) => <Link href={`/inventory/products/${row.original.product.id}`} className="font-medium hover:underline">{row.original.name}</Link> },
    { id: "unit", header: "Unit", accessorFn: (r) => r.product.unit },
    { accessorKey: "qty", header: "Quantity", meta: { align: "right" }, cell: ({ row }) => (<span className="inline-flex items-center gap-2">{row.original.qty <= 0 ? <Badge tone="bad">Out</Badge> : row.original.low ? <Badge tone="warn">Low</Badge> : null}{formatQty(row.original.qty)}</span>) },
    { accessorKey: "avgCost", header: "Avg cost", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { accessorKey: "value", header: "Value (avg)", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { accessorKey: "fifo", header: "Value (FIFO)", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { accessorKey: "suggest", header: "Reorder", meta: { align: "right" }, cell: ({ getValue }) => (Number(getValue()) > 0 ? <span className="num text-warn">Order {formatQty(Number(getValue()))}</span> : <span className="text-muted">-</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Quantity and value on hand. Books use weighted average cost; FIFO value is shown for comparison."
        actions={
          <Button onClick={() => downloadText("stock-summary.csv", toCsv(["Product", "Unit", "Quantity", "Avg cost", "Value avg", "Value FIFO"], rows.map((r) => [r.name, r.product.unit, r.qty, r.avgCost, r.value, r.fifo])))} disabled={!rows.length}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Panel className="p-4"><p className="text-xs text-muted">Stock value (weighted average)</p><p className="mt-1 text-xl font-semibold"><Money value={total} /></p></Panel>
        <Panel className="p-4"><p className="text-xs text-muted">Items at or below reorder level</p><p className="num mt-1 text-xl font-semibold">{lowCount}</p></Panel>
        <Panel className="p-4"><p className="text-xs text-muted">Batches expiring in 60 days</p><p className="num mt-1 text-xl font-semibold">{expiring.length}</p></Panel>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={products.isPending || movements.isPending}
        error={products.error ?? movements.error}
        noun="items"
        searchKeys={["name"]}
        rowKey={(r) => r.id}
        empty={{ title: "No stock to show", reason: "Add products and record purchases to see quantities and value here.", actionLabel: "Add a product", actionHref: "/inventory/products?new=1" }}
        filters={
          <NativeSelect aria-label="Warehouse" value={wh} onChange={(e) => setWh(e.target.value)} className="h-9 w-48">
            <option value="">All warehouses</option>
            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </NativeSelect>
        }
        activeFilters={wh ? 1 : 0}
        onClearFilters={() => setWh("")}
      />
      {expiring.length > 0 && !lite ? (
        <Panel className="mt-5">
          <PanelHeader title="Expiring batches" />
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2 text-right">Quantity</th></tr></thead>
            <tbody>
              {expiring.map((b) => (
                <tr key={`${b.productId}${b.batchNo}${b.warehouseId}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5">{b.name}</td>
                  <td className="num px-3 py-2.5">{b.batchNo}</td>
                  <td className="px-3 py-2.5"><span className="num">{formatDate(b.expiry)}</span> <Badge tone={b.daysLeft < 0 ? "bad" : "warn"}>{b.daysLeft < 0 ? "Expired" : `${b.daysLeft} days`}</Badge></td>
                  <td className="num px-3 py-2.5 text-right">{formatQty(b.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </>
  );
}
