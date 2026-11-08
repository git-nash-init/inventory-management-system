"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/ui/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/tables/data-table";
import { SuccessPanel } from "@/components/states/success-panel";
import { getRepo } from "@/data";
import { errorMessage, useMovements, useProducts, useRepoMutation, useWarehouses } from "@/data/hooks";
import { useAuth } from "@/lib/auth/context";
import { stockSummary } from "@/domain/reports";
import { adjustSchema, type AdjustForm } from "@/lib/validation/entities";
import { formatDate, toISODate } from "@/lib/format/date";
import { formatQty } from "@/lib/format/money";
import type { AdjustInput, StockMovement } from "@/domain/types";

const REASONS: { value: AdjustForm["reason"]; label: string }[] = [
  { value: "damage", label: "Damaged" },
  { value: "loss", label: "Lost or stolen" },
  { value: "expired", label: "Expired" },
  { value: "audit", label: "Stock count correction" },
  { value: "found", label: "Found extra" },
  { value: "other", label: "Other" },
];

function AdjustDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useProducts();
  const warehouses = useWarehouses();
  const save = useRepoMutation((i: AdjustInput) => getRepo().stock.adjust(i));
  const form = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema), mode: "onBlur", reValidateMode: "onChange",
    defaultValues: { date: toISODate(new Date()), productId: "", warehouseId: "", direction: "remove", qty: 1, reason: "damage", batchNo: "", expiry: "", note: "" },
  });
  const { errors } = form.formState;
  const [done, setDone] = React.useState<string>();
  async function onSubmit(v: AdjustForm) {
    try {
      await save.mutateAsync({ date: v.date, productId: v.productId, warehouseId: v.warehouseId, qty: v.direction === "remove" ? -v.qty : v.qty, reason: v.reason, batchNo: v.batchNo || undefined, expiry: v.expiry || undefined, note: v.note });
      const p = products.data?.find((x) => x.id === v.productId);
      setDone(`${v.direction === "remove" ? "Removed" : "Added"} ${v.qty} ${p?.unit ?? ""} of ${p?.name ?? "the product"}.`);
      toast.success("Adjustment saved");
    } catch (e) {
      const m = errorMessage(e);
      if (m.field === "qty" || m.field === "productId") form.setError(m.field, { message: m.message });
      else toast.error(m.message);
    }
  }
  const stockable = (products.data ?? []).filter((p) => !p.isService);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDone(undefined); }}>
      <DialogContent title="New stock adjustment" description="Correct stock for damage, loss, expiry or a count difference. The value is posted to your books.">
        {done ? (
          <div className="space-y-3">
            <SuccessPanel title="Adjustment saved" detail={done} steps={[{ label: "Add another", onClick: () => { setDone(undefined); form.reset(); } }, { label: "Close", onClick: () => onOpenChange(false) }]} />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <Field label="Date" htmlFor="adate" error={errors.date?.message} required><Input id="adate" type="date" {...form.register("date")} /></Field>
            <Field label="Warehouse" htmlFor="awh" error={errors.warehouseId?.message} required>
              <NativeSelect id="awh" {...form.register("warehouseId")}><option value="">Choose</option>{warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
            </Field>
            <Field label="Product" htmlFor="aprod" error={errors.productId?.message} required className="sm:col-span-2">
              <NativeSelect id="aprod" {...form.register("productId")}><option value="">Choose</option>{stockable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
            </Field>
            <Field label="Action" htmlFor="adir"><NativeSelect id="adir" {...form.register("direction")}><option value="remove">Remove stock</option><option value="add">Add stock</option></NativeSelect></Field>
            <Field label="Quantity" htmlFor="aqty" error={errors.qty?.message} required><Input id="aqty" type="number" step="any" {...form.register("qty", { valueAsNumber: true })} /></Field>
            <Field label="Reason" htmlFor="areason"><NativeSelect id="areason" {...form.register("reason")}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect></Field>
            <Field label="Batch (if tracked)" htmlFor="abatch"><Input id="abatch" {...form.register("batchNo")} /></Field>
            <Field label="Note" htmlFor="anote" className="sm:col-span-2"><Input id="anote" {...form.register("note")} /></Field>
            <div className="flex justify-end gap-2 border-t border-line pt-3 sm:col-span-2">
              <Button onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save adjustment"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Physical stock-take: enter counted quantities, only differences become adjustments. */
function StockTake() {
  const products = useProducts();
  const movements = useMovements();
  const warehouses = useWarehouses();
  const [wh, setWh] = React.useState("");
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const warehouse = wh || warehouses.data?.find((w) => w.isDefault)?.id || "";
  const qc = useRepoMutation(async () => undefined);

  const rows = React.useMemo(() => (products.data && movements.data ? stockSummary(products.data, movements.data, warehouse).filter((r) => !r.variantId || true) : []), [products.data, movements.data, warehouse]);
  const diffs = rows.map((r) => ({ r, counted: counts[r.product.id] === undefined || counts[r.product.id] === "" ? undefined : Number(counts[r.product.id]) })).filter((x) => x.counted !== undefined && !Number.isNaN(x.counted) && x.counted !== x.r.qty);

  async function apply() {
    setBusy(true);
    let n = 0;
    try {
      for (const d of diffs) {
        await getRepo().stock.adjust({ date: toISODate(new Date()), productId: d.r.product.id, variantId: d.r.variantId, warehouseId: warehouse, qty: (d.counted as number) - d.r.qty, reason: "audit", note: "Physical stock count" });
        n++;
      }
      toast.success(`${n} items corrected`);
      setCounts({});
      await qc.mutateAsync(undefined);
    } catch (e) {
      toast.error(`${errorMessage(e).message} (${n} items were corrected before this error)`);
      await qc.mutateAsync(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <NativeSelect aria-label="Warehouse to count" value={warehouse} onChange={(e) => setWh(e.target.value)} className="h-9 w-56">
          {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </NativeSelect>
        <p className="text-sm text-muted">Enter what you counted. Leave blank to skip an item.</p>
        <Button variant="primary" className="ml-auto" disabled={!diffs.length || busy} onClick={() => void apply()}>{busy ? "Applying" : `Apply ${diffs.length} corrections`}</Button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted"><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">System</th><th className="px-3 py-2 text-right">Counted</th><th className="px-3 py-2 text-right">Difference</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const raw = counts[r.product.id];
            const counted = raw === undefined || raw === "" ? undefined : Number(raw);
            const diff = counted === undefined || Number.isNaN(counted) ? undefined : counted - r.qty;
            return (
              <tr key={r.product.id + (r.variantId ?? "")} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{r.product.name}</td>
                <td className="num px-3 py-2 text-right">{formatQty(r.qty)}</td>
                <td className="px-3 py-1.5 text-right"><input type="number" step="any" aria-label={`Counted quantity for ${r.product.name}`} value={raw ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [r.product.id]: e.target.value }))} className="num h-8 w-24 rounded border border-line bg-surface px-2 text-right" /></td>
                <td className={`num px-3 py-2 text-right ${diff ? (diff < 0 ? "text-bad" : "text-ok") : "text-muted"}`}>{diff === undefined ? "-" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function AdjustmentsPage() {
  const { can } = useAuth();
  const movements = useMovements();
  const products = useProducts();
  const warehouses = useWarehouses();
  const [open, setOpen] = React.useState(false);
  const rows = (movements.data ?? []).filter((m) => m.type === "adjustment").reverse();
  const columns: ColumnDef<StockMovement, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { id: "p", header: "Product", accessorFn: (m) => products.data?.find((p) => p.id === m.productId)?.name ?? "" },
    { id: "w", header: "Warehouse", accessorFn: (m) => warehouses.data?.find((w) => w.id === m.warehouseId)?.name ?? "" },
    { accessorKey: "qty", header: "Change", meta: { align: "right" }, cell: ({ getValue }) => <span className={Number(getValue()) < 0 ? "text-bad" : "text-ok"}>{Number(getValue()) > 0 ? "+" : ""}{formatQty(Number(getValue()))}</span> },
    { accessorKey: "reason", header: "Reason" },
  ];
  return (
    <>
      <PageHeader title="Stock adjustments" description="Every correction with its reason." actions={can("inventory", "create") ? <Button variant="primary" onClick={() => setOpen(true)}>New adjustment</Button> : undefined} />
      <Tabs defaultValue="history">
        <TabsList className="mb-4"><TabsTrigger value="history">History</TabsTrigger>{can("inventory", "create") ? <TabsTrigger value="take">Physical stock take</TabsTrigger> : null}</TabsList>
        <TabsContent value="history">
          <DataTable columns={columns} data={rows} isLoading={movements.isPending} error={movements.error} onRetry={() => void movements.refetch()} noun="adjustments" rowKey={(r) => r.id} searchKeys={["reason"]} empty={{ title: "No adjustments yet", reason: "Adjust stock when something is damaged, lost, expired or a count does not match.", actionLabel: "New adjustment", onAction: () => setOpen(true) }} />
        </TabsContent>
        <TabsContent value="take"><StockTake /></TabsContent>
      </Tabs>
      <AdjustDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
