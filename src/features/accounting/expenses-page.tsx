"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Receipt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { getRepo } from "@/data";
import { errorMessage, useAccounts, useExpenses, useRepoMutation } from "@/data/hooks";
import { EXPENSE_CATEGORIES } from "@/domain/accounts";
import type { Expense, ExpenseInput } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { expenseSchema, type ExpenseForm } from "@/lib/validation/entities";
import { formatDate, toISODate } from "@/lib/format/date";
import { readCheckedFile } from "@/lib/security/upload";

function ExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useAccounts();
  const form = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { date: toISODate(new Date()), category: "", amount: 0, gstAmount: 0, payFromAccountId: "acc-cash", vendor: "", notes: "" } });
  const [file, setFile] = React.useState<{ name: string; dataUrl: string }>();
  const [fileMsg, setFileMsg] = React.useState<string>();
  const save = useRepoMutation((e: ExpenseInput) => getRepo().expenses.create(e));
  const { errors } = form.formState;
  async function onSubmit(v: ExpenseForm) {
    const cat = EXPENSE_CATEGORIES.find((c) => c.label === v.category);
    try {
      await save.mutateAsync({ ...v, accountId: cat?.accountId ?? "acc-misc", attachmentName: file?.name, attachmentDataUrl: file?.dataUrl });
      toast.success("Expense saved");
      form.reset();
      setFile(undefined);
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field && m.field in v) form.setError(m.field as keyof ExpenseForm, { message: m.message });
      else toast.error(m.message);
    }
  }
  const cashBank = (accounts.data ?? []).filter((a) => a.group === "Cash in Hand" || a.group === "Bank Accounts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New expense" description="Rent, electricity, salaries, transport and anything else you spend.">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Date" htmlFor="edate" error={errors.date?.message} required><Input id="edate" type="date" {...form.register("date")} /></Field>
          <Field label="Category" htmlFor="ecat" error={errors.category?.message} required><NativeSelect id="ecat" {...form.register("category")}><option value="">Choose</option>{EXPENSE_CATEGORIES.map((c) => <option key={c.label}>{c.label}</option>)}</NativeSelect></Field>
          <Field label="Amount (before GST)" htmlFor="eamt" error={errors.amount?.message} required><Input id="eamt" type="number" step="any" className="num" {...form.register("amount", { valueAsNumber: true })} /></Field>
          <Field label="GST paid on it" htmlFor="egst" error={errors.gstAmount?.message} hint="Claimed as input tax credit."><Input id="egst" type="number" step="any" className="num" {...form.register("gstAmount", { valueAsNumber: true })} /></Field>
          <Field label="Paid from" htmlFor="epay" error={errors.payFromAccountId?.message} required><NativeSelect id="epay" {...form.register("payFromAccountId")}>{cashBank.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
          <Field label="Paid to" htmlFor="evend"><Input id="evend" {...form.register("vendor")} /></Field>
          <Field label="Notes" htmlFor="enotes" className="sm:col-span-2"><Input id="enotes" {...form.register("notes")} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-medium text-muted">Bill or receipt (PDF, PNG or JPG, up to 5 MB)</p>
            <input type="file" accept="application/pdf,image/png,image/jpeg" aria-label="Expense bill" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await readCheckedFile(f, "document"); if (r.ok) { setFile({ name: r.name, dataUrl: r.dataUrl }); setFileMsg(undefined); } else setFileMsg(r.message); }} className="text-sm" />
            {file ? <p className="mt-1 text-xs text-ok">Attached: {file.name}</p> : null}
            {fileMsg ? <p role="alert" className="mt-1 text-xs text-bad">{fileMsg}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3 sm:col-span-2"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save expense"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpensesPage() {
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const q = useExpenses();
  const [open, setOpen] = React.useState(params.get("new") === "1");
  const columns: ColumnDef<Expense, unknown>[] = [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="num">{String(getValue())}</span> },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))}</span> },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "vendor", header: "Paid to" },
    { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { accessorKey: "gstAmount", header: "GST", meta: { align: "right" }, cell: ({ getValue }) => <Money value={Number(getValue())} /> },
    { id: "att", header: "Bill", enableSorting: false, cell: ({ row }) => (row.original.attachmentDataUrl ? <a className="link" href={row.original.attachmentDataUrl} download={row.original.attachmentName} onClick={(e) => e.stopPropagation()}>Download</a> : "") },
  ];
  return (
    <>
      <PageHeader title="Expenses" description="Money spent running the business, with the bill attached." actions={can("accounting", "create") ? <Button variant="primary" onClick={() => setOpen(true)}>New expense</Button> : undefined} />
      <DataTable columns={columns} data={q.data?.slice().reverse()} isLoading={q.isPending} error={q.error} onRetry={() => void q.refetch()} noun="expenses" searchKeys={["number", "category", "vendor"]} rowKey={(r) => r.id} initialSort={[{ id: "date", desc: true }]}
        empty={{ title: "No expenses yet", reason: "Record rent, electricity, salaries and other costs so your profit and loss is right.", icon: <Receipt size={28} />, actionLabel: can("accounting", "create") ? "Add an expense" : undefined, onAction: () => setOpen(true) }} />
      <ExpenseDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && params.get("new")) router.replace("/accounting/expenses"); }} />
    </>
  );
}
