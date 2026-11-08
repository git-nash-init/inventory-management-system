"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { getRepo } from "@/data";
import { errorMessage, useMovements, useProducts, useRepoMutation, useWarehouses } from "@/data/hooks";
import { useAuth } from "@/lib/auth/context";
import { transferSchema, type TransferForm } from "@/lib/validation/entities";
import { formatDate, toISODate } from "@/lib/format/date";
import { formatQty } from "@/lib/format/money";
import type { StockMovement, TransferInput } from "@/domain/types";

function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useProducts();
  const warehouses = useWarehouses();
  const save = useRepoMutation((i: TransferInput) => getRepo().stock.transfer(i));
  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema), mode: "onBlur", reValidateMode: "onChange",
    defaultValues: { date: toISODate(new Date()), productId: "", fromWarehouseId: "", toWarehouseId: "", qty: 1, note: "" },
  });
  const { errors } = form.formState;
  async function onSubmit(v: TransferForm) {
    try {
      await save.mutateAsync(v);
      toast.success("Stock transferred");
      form.reset();
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field === "qty" || m.field === "toWarehouseId") form.setError(m.field, { message: m.message });
      else toast.error(m.message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Transfer stock" description="Move stock between warehouses. Value stays the same.">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Date" htmlFor="tdate" error={errors.date?.message} required><Input id="tdate" type="date" {...form.register("date")} /></Field>
          <Field label="Quantity" htmlFor="tqty" error={errors.qty?.message} required><Input id="tqty" type="number" step="any" {...form.register("qty", { valueAsNumber: true })} /></Field>
          <Field label="Product" htmlFor="tprod" error={errors.productId?.message} required className="sm:col-span-2">
            <NativeSelect id="tprod" {...form.register("productId")}><option value="">Choose</option>{(products.data ?? []).filter((p) => !p.isService).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
          </Field>
          <Field label="From" htmlFor="tfrom" error={errors.fromWarehouseId?.message} required>
            <NativeSelect id="tfrom" {...form.register("fromWarehouseId")}><option value="">Choose</option>{warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
          </Field>
          <Field label="To" htmlFor="tto" error={errors.toWarehouseId?.message} required>
            <NativeSelect id="tto" {...form.register("toWarehouseId")}><option value="">Choose</option>{warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
          </Field>
          <Field label="Note" htmlFor="tnote" className="sm:col-span-2"><Input id="tnote" {...form.register("note")} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-3 sm:col-span-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Moving" : "Transfer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransfersPage() {
  const { can } = useAuth();
  const movements = useMovements();
  const products = useProducts();
  const warehouses = useWarehouses();
  const [open, setOpen] = React.useState(false);
  const rows = (movements.data ?? []).filter((m) => m.type === "transfer_out").reverse();
  const toOf = (m: StockMovement) => {
    const inn = movements.data?.find((x) => x.type === "transfer_in" && x.date === m.date && x.productId === m.productId && -x.qty === m.qty && x.warehouseId !== m.warehouseId);
    return warehouses.data?.find((w) => w.id === inn?.warehouseId)?.name ?? "";
  };
  const columns: ColumnDef<StockMovement, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { id: "p", header: "Product", accessorFn: (m) => products.data?.find((p) => p.id === m.productId)?.name ?? "" },
    { id: "f", header: "From", accessorFn: (m) => warehouses.data?.find((w) => w.id === m.warehouseId)?.name ?? "" },
    { id: "t", header: "To", accessorFn: (m) => toOf(m) },
    { accessorKey: "qty", header: "Quantity", meta: { align: "right" }, cell: ({ getValue }) => formatQty(-Number(getValue())) },
    { accessorKey: "reason", header: "Note" },
  ];
  return (
    <>
      <PageHeader title="Stock transfers" description="Movements between your warehouses." actions={can("inventory", "create") ? <Button variant="primary" onClick={() => setOpen(true)}>New transfer</Button> : undefined} />
      <DataTable columns={columns} data={rows} isLoading={movements.isPending} error={movements.error} onRetry={() => void movements.refetch()} noun="transfers" rowKey={(r) => r.id}
        empty={{ title: "No transfers yet", reason: "Move stock from the godown to the shop counter, or between branches, and it is recorded here.", actionLabel: "New transfer", onAction: () => setOpen(true) }} />
      <TransferDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
