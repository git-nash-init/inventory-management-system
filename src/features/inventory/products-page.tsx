"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Package } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/surface";
import { Money } from "@/components/ui/amount";
import { DataTable } from "@/components/tables/data-table";
import { useMovements, useProducts, useRepoMutation } from "@/data/hooks";
import { getRepo } from "@/data";
import { useAuth } from "@/lib/auth/context";
import { stockSummary } from "@/domain/reports";
import { formatQty } from "@/lib/format/money";
import type { Product } from "@/domain/types";
import { ProductDialog } from "./product-dialog";
import { ImportDialog, exportProducts } from "./import-dialog";

type Row = Product & { qty: number; value: number; low: boolean };

export function ProductsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const products = useProducts();
  const movements = useMovements();
  const [category, setCategory] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("");
  const [editing, setEditing] = React.useState<Product | undefined>();
  const [open, setOpen] = React.useState(params.get("new") === "1");
  const [importing, setImporting] = React.useState(false);
  const remove = useRepoMutation((id: string) => getRepo().products.remove(id));

  const rows = React.useMemo<Row[]>(() => {
    if (!products.data || !movements.data) return [];
    const sum = stockSummary(products.data, movements.data);
    return products.data.map((p) => {
      const mine = sum.filter((s) => s.product.id === p.id);
      const qty = mine.reduce((a, s) => a + s.qty, 0);
      const value = mine.reduce((a, s) => a + s.value, 0);
      return { ...p, qty, value, low: mine.some((s) => s.low) };
    });
  }, [products.data, movements.data]);

  const categories = React.useMemo(() => [...new Set((products.data ?? []).map((p) => p.category).filter(Boolean))].sort(), [products.data]);
  const filtered = rows.filter((r) => (!category || r.category === category) && (!stockFilter || (stockFilter === "low" ? r.low && r.qty > 0 : stockFilter === "out" ? !r.isService && r.qty <= 0 : r.isService || r.qty > 0)));
  const activeFilters = Number(Boolean(category)) + Number(Boolean(stockFilter));
  const canCreate = can("inventory", "create");
  const canEdit = can("inventory", "edit");

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <Link href={`/inventory/products/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {row.original.name}
            </Link>
            <div className="text-xs text-muted">
              {[row.original.sku, row.original.category].filter(Boolean).join(" · ")}
              {row.original.isService ? " · Service" : ""}
            </div>
          </div>
        ),
      },
      { accessorKey: "hsn", header: "HSN", cell: ({ getValue }) => <span className="num">{String(getValue() || "-")}</span> },
      { accessorKey: "gstRate", header: "GST", meta: { align: "right" }, cell: ({ getValue }) => `${getValue()}%` },
      { accessorKey: "purchasePrice", header: "Cost", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
      { accessorKey: "salePrice", header: "Price", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
      {
        accessorKey: "qty",
        header: "In stock",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.isService ? (
            <span className="text-muted">-</span>
          ) : (
            <span className="inline-flex items-center justify-end gap-2">
              {row.original.qty <= 0 ? <Badge tone="bad">Out</Badge> : row.original.low ? <Badge tone="warn">Low</Badge> : null}
              <span className="num">{formatQty(row.original.qty)} {row.original.unit}</span>
            </span>
          ),
      },
      { accessorKey: "value", header: "Stock value", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          can("inventory", "delete") ? (
            <button
              className="link text-xs text-bad"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await remove.mutateAsync(row.original.id);
                  toast.success(`${row.original.name} deleted`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not delete");
                }
              }}
            >
              Delete
            </button>
          ) : null,
      },
    ],
    [can, remove],
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you buy, make or sell, with stock and valuation."
        actions={
          <>
            <Button onClick={() => products.data && exportProducts(products.data)} disabled={!products.data?.length}>Export CSV</Button>
            <Link href="/inventory/labels" className="inline-flex h-9 items-center rounded border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2">Print labels</Link>
            {canCreate ? <Button onClick={() => setImporting(true)}>Import CSV</Button> : null}
            {canCreate ? (
              <Button variant="primary" onClick={() => { setEditing(undefined); setOpen(true); }}>
                New product
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={products.isPending || movements.isPending}
        error={products.error ?? movements.error}
        onRetry={() => { void products.refetch(); void movements.refetch(); }}
        noun="products"
        searchKeys={["name", "sku", "barcode", "hsn", "category", "brand"]}
        searchLabel="Search by name, SKU, barcode or HSN"
        initialQuery={params.get("q") ?? ""}
        activeFilters={activeFilters}
        onClearFilters={() => { setCategory(""); setStockFilter(""); }}
        onCreateFromQuery={canCreate ? (q) => router.push(`/inventory/products?new=1&name=${encodeURIComponent(q)}`) : undefined}
        empty={{
          title: "No products yet",
          reason: "Add your first product, or import many at once from a CSV file exported from Excel.",
          icon: <Package size={28} />,
          actionLabel: canCreate ? "Add your first product" : undefined,
          onAction: () => { setEditing(undefined); setOpen(true); },
          secondary: canCreate ? <Button onClick={() => setImporting(true)}>Import from Excel (CSV)</Button> : undefined,
        }}
        filters={
          <>
            <NativeSelect aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-40">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </NativeSelect>
            <NativeSelect aria-label="Stock status" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="h-9 w-36">
              <option value="">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </NativeSelect>
          </>
        }
        onRowClick={canEdit ? (p) => { setEditing(products.data?.find((x) => x.id === p.id)); setOpen(true); } : undefined}
        rowKey={(r) => r.id}
        initialSort={[{ id: "name", desc: false }]}
      />
      <ProductDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(undefined); if (params.get("new")) router.replace("/inventory/products"); } }}
        product={editing}
        prefill={params.get("name") ? { name: params.get("name") ?? "" } : undefined}
        categories={categories}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </>
  );
}
