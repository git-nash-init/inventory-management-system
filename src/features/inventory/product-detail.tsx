"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/amount";
import { Panel, PageHeader, Skeleton } from "@/components/ui/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/tables/data-table";
import { ErrorState } from "@/components/states/error-state";
import { useAuth } from "@/lib/auth/context";
import { useMovements, useProducts, useWarehouses } from "@/data/hooks";
import { batchStock, type State } from "@/domain/engine";
import { stockSummary } from "@/domain/reports";
import { formatDate, daysBetween } from "@/lib/format/date";
import { formatQty } from "@/lib/format/money";
import type { StockMovement } from "@/domain/types";
import { ProductDialog } from "./product-dialog";

type LedgerRow = StockMovement & { balance: number; wh: string };

const TYPE_LABEL: Record<string, string> = {
  opening: "Opening stock", purchase: "Purchase", sale: "Sale", sales_return: "Sales return", purchase_return: "Purchase return",
  adjustment: "Adjustment", transfer_out: "Transfer out", transfer_in: "Transfer in",
};

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const products = useProducts();
  const movements = useMovements();
  const warehouses = useWarehouses();
  const [edit, setEdit] = React.useState(false);
  const product = products.data?.find((p) => p.id === id);

  const ledger = React.useMemo<LedgerRow[]>(() => {
    if (!movements.data || !product) return [];
    let run = 0;
    return movements.data
      .filter((m) => m.productId === product.id)
      .map((m) => {
        run += m.qty;
        return { ...m, balance: Math.round(run * 1000) / 1000, wh: warehouses.data?.find((w) => w.id === m.warehouseId)?.name ?? "" };
      })
      .reverse();
  }, [movements.data, product, warehouses.data]);

  const batches = React.useMemo(() => {
    if (!product || !movements.data || !warehouses.data) return [];
    const fake = { movements: movements.data } as unknown as State;
    return warehouses.data.flatMap((w) => batchStock(fake, product.id, undefined, w.id).filter((b) => b.batchNo).map((b) => ({ ...b, wh: w.name })));
  }, [product, movements.data, warehouses.data]);

  if (products.isPending || movements.isPending) return <Skeleton className="h-64 w-full" />;
  if (products.error) return <ErrorState what="Product could not be loaded" blame="network" onRetry={() => void products.refetch()} />;
  if (!product) return <ErrorState what="This product does not exist" blame="input" detail="It may have been deleted." />;

  const sum = stockSummary(products.data ?? [], movements.data ?? []).filter((s) => s.product.id === product.id);
  const qty = sum.reduce((a, s) => a + s.qty, 0);
  const value = sum.reduce((a, s) => a + s.value, 0);
  const today = new Date().toISOString().slice(0, 10);

  const cols: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => TYPE_LABEL[String(getValue())] ?? String(getValue()) },
    { accessorKey: "refNumber", header: "Reference", cell: ({ row }) => <span className="num">{row.original.refNumber ?? row.original.reason ?? "-"}</span> },
    { accessorKey: "wh", header: "Warehouse" },
    { accessorKey: "qty", header: "Change", meta: { align: "right" }, cell: ({ getValue }) => <span className={Number(getValue()) < 0 ? "text-bad" : "text-ok"}>{Number(getValue()) > 0 ? "+" : ""}{formatQty(Number(getValue()))}</span> },
    { accessorKey: "rate", header: "Cost", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { accessorKey: "balance", header: "Balance", meta: { align: "right" }, cell: ({ getValue }) => formatQty(Number(getValue())) },
  ];

  return (
    <>
      <PageHeader
        title={product.name}
        description={[product.sku, product.category, product.brand].filter(Boolean).join(" · ") || "Product"}
        actions={
          <>
            <Link href="/inventory/products" className="link text-sm">All products</Link>
            {can("inventory", "edit") ? <Button onClick={() => setEdit(true)}>Edit</Button> : null}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["In stock", product.isService ? "Service" : `${formatQty(qty)} ${product.unit}`],
          ["Stock value", null],
          ["Price", null],
          ["GST and HSN", `${product.gstRate}% · ${product.hsn || "no HSN"}`],
        ].map(([label, text], i) => (
          <Panel key={label as string} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold">
              {i === 1 ? <Money value={value} /> : i === 2 ? <Money value={product.salePrice} /> : <span className="num">{text}</span>}
            </p>
            {i === 0 && product.reorderLevel > 0 && !product.isService ? <p className="mt-1 text-xs text-muted">Reorder at {formatQty(product.reorderLevel)}</p> : null}
            {i === 2 ? <p className="mt-1 text-xs text-muted">Cost <Money value={product.purchasePrice} /> · MRP <Money value={product.mrp} /></p> : null}
          </Panel>
        ))}
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="mb-4">
          <TabsTrigger value="ledger">Stock ledger</TabsTrigger>
          <TabsTrigger value="warehouses">By warehouse</TabsTrigger>
          {product.trackBatch ? <TabsTrigger value="batches">Batches and expiry</TabsTrigger> : null}
          {product.variants.length ? <TabsTrigger value="variants">Variants</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="ledger">
          <DataTable columns={cols} data={ledger} isLoading={false} noun="movements" rowKey={(r) => r.id} empty={{ title: "No stock movements", reason: "Every purchase, sale, adjustment and transfer of this product will be listed here." }} />
        </TabsContent>
        <TabsContent value="warehouses">
          <Panel>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted"><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2 text-right">Quantity</th></tr></thead>
              <tbody>
                {warehouses.data?.map((w) => {
                  const q = stockSummary([product], movements.data ?? [], w.id).reduce((a, s) => a + s.qty, 0);
                  return <tr key={w.id} className="border-b border-line last:border-0"><td className="px-3 py-2.5">{w.name}</td><td className="num px-3 py-2.5 text-right">{formatQty(q)} {product.unit}</td></tr>;
                })}
              </tbody>
            </table>
          </Panel>
        </TabsContent>
        <TabsContent value="batches">
          <Panel>
            {batches.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No batches in stock. Enter a batch number and expiry when you buy this product.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted"><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2 text-right">Quantity</th></tr></thead>
                <tbody>
                  {batches.sort((a, b) => (a.expiry ?? "").localeCompare(b.expiry ?? "")).map((b) => {
                    const left = b.expiry ? daysBetween(new Date(today + "T00:00:00"), new Date(b.expiry + "T00:00:00")) : null;
                    return (
                      <tr key={b.wh + b.batchNo} className="border-b border-line last:border-0">
                        <td className="num px-3 py-2.5">{b.batchNo}</td>
                        <td className="px-3 py-2.5">{b.wh}</td>
                        <td className="px-3 py-2.5"><span className="num">{b.expiry ? formatDate(b.expiry) : "-"}</span>{left !== null && left <= 30 ? <Badge tone={left < 0 ? "bad" : "warn"} className="ml-2">{left < 0 ? "Expired" : `${left} days left`}</Badge> : null}</td>
                        <td className="num px-3 py-2.5 text-right">{formatQty(b.qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="variants">
          <Panel>
            <ul className="divide-y divide-line text-sm">
              {product.variants.map((v) => (
                <li key={v.id} className="flex justify-between px-4 py-2.5"><span>{v.name}</span><span className="num text-muted">{v.sku}</span></li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
      <ProductDialog open={edit} onOpenChange={setEdit} product={product} categories={[]} />
    </>
  );
}
