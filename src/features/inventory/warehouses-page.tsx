"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Warehouse as WarehouseIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { getRepo } from "@/data";
import { errorMessage, useRepoMutation, useWarehouses } from "@/data/hooks";
import { useAuth } from "@/lib/auth/context";
import { warehouseSchema, type WarehouseForm } from "@/lib/validation/entities";
import type { Warehouse } from "@/domain/types";

function WarehouseDialog({ open, onOpenChange, warehouse }: { open: boolean; onOpenChange: (o: boolean) => void; warehouse?: Warehouse }) {
  const form = useForm<WarehouseForm>({
    resolver: zodResolver(warehouseSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    values: warehouse ? { name: warehouse.name, address: warehouse.address, isDefault: warehouse.isDefault } : { name: "", address: "", isDefault: false },
  });
  const save = useRepoMutation((w: Omit<Warehouse, "id"> & { id?: string }) => getRepo().warehouses.save(w));
  const { errors } = form.formState;
  async function onSubmit(v: WarehouseForm) {
    try {
      await save.mutateAsync({ ...v, id: warehouse?.id });
      toast.success(`${v.name} saved`);
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field === "name") form.setError("name", { message: m.message });
      else toast.error(m.message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={warehouse ? "Edit warehouse" : "New warehouse"}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Name" htmlFor="wname" error={errors.name?.message} required>
            <Input id="wname" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
          </Field>
          <Field label="Address" htmlFor="waddr" error={errors.address?.message}>
            <Input id="waddr" {...form.register("address")} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("isDefault")} /> Use as the default warehouse</label>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WarehousesPage() {
  const { can } = useAuth();
  const q = useWarehouses();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Warehouse>();
  const remove = useRepoMutation((id: string) => getRepo().warehouses.remove(id));
  const columns: ColumnDef<Warehouse, unknown>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name} {row.original.isDefault ? <Badge tone="accent" className="ml-1">Default</Badge> : null}</span> },
    { accessorKey: "address", header: "Address" },
    {
      id: "a", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" },
      cell: ({ row }) => can("inventory", "delete") ? (
        <button className="link text-xs text-bad" onClick={async (e) => { e.stopPropagation(); try { await remove.mutateAsync(row.original.id); toast.success("Warehouse deleted"); } catch (err) { toast.error(errorMessage(err).message); } }}>Delete</button>
      ) : null,
    },
  ];
  return (
    <>
      <PageHeader title="Warehouses" description="Godowns, shops and any place you keep stock." actions={can("inventory", "create") ? <Button variant="primary" onClick={() => { setEditing(undefined); setOpen(true); }}>New warehouse</Button> : undefined} />
      <DataTable
        columns={columns} data={q.data} isLoading={q.isPending} error={q.error} onRetry={() => void q.refetch()} noun="warehouses" rowKey={(r) => r.id}
        onRowClick={can("inventory", "edit") ? (w) => { setEditing(w); setOpen(true); } : undefined}
        empty={{ title: "No warehouses", reason: "Add a warehouse to start tracking where stock is kept.", icon: <WarehouseIcon size={28} />, actionLabel: "Add warehouse", onAction: () => setOpen(true) }}
      />
      <WarehouseDialog key={editing?.id ?? "new"} open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }} warehouse={editing} />
    </>
  );
}
