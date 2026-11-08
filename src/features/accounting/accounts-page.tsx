"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/surface";
import { TableSkeleton } from "@/components/states/skeletons";
import { ErrorState } from "@/components/states/error-state";
import { getRepo } from "@/data";
import { errorMessage, useAccounts, useJournal, useRepoMutation } from "@/data/hooks";
import { accountTotals, naturalBalance } from "@/domain/reports";
import type { Account, AccountGroup, AccountNature } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { accountSchema, type AccountForm } from "@/lib/validation/entities";

const GROUPS: { group: AccountGroup; nature: AccountNature }[] = [
  { group: "Capital Account", nature: "capital" }, { group: "Reserves and Surplus", nature: "capital" },
  { group: "Cash in Hand", nature: "asset" }, { group: "Bank Accounts", nature: "asset" }, { group: "Current Assets", nature: "asset" }, { group: "Stock in Hand", nature: "asset" },
  { group: "Sundry Debtors", nature: "asset" }, { group: "Current Liabilities", nature: "liability" }, { group: "Sundry Creditors", nature: "liability" }, { group: "Duties and Taxes", nature: "liability" }, { group: "Loans", nature: "liability" },
  { group: "Sales Accounts", nature: "income" }, { group: "Direct Income", nature: "income" }, { group: "Indirect Income", nature: "income" },
  { group: "Purchase Accounts", nature: "expense" }, { group: "Direct Expenses", nature: "expense" }, { group: "Indirect Expenses", nature: "expense" },
];

function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useForm<AccountForm>({ resolver: zodResolver(accountSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { code: "", name: "", group: "Indirect Expenses" } });
  const save = useRepoMutation((a: Omit<Account, "id">) => getRepo().accounts.save(a));
  const { errors } = form.formState;
  async function onSubmit(v: AccountForm) {
    const g = GROUPS.find((x) => x.group === v.group)!;
    try {
      await save.mutateAsync({ code: v.code, name: v.name, group: g.group, nature: g.nature, system: false });
      toast.success(`${v.name} added`);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field === "code" || m.field === "name") form.setError(m.field, { message: m.message });
      else toast.error(m.message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New account" description="Add a ledger account under an Indian accounting group.">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Group" htmlFor="ag" error={errors.group?.message} required><NativeSelect id="ag" {...form.register("group")}>{GROUPS.map((g) => <option key={g.group}>{g.group}</option>)}</NativeSelect></Field>
          <Field label="Code" htmlFor="ac" error={errors.code?.message} required hint="3 to 6 digits"><Input id="ac" className="num" {...form.register("code")} /></Field>
          <Field label="Name" htmlFor="an" error={errors.name?.message} required><Input id="an" {...form.register("name")} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-3"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Add account"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountsPage() {
  const { can } = useAuth();
  const accounts = useAccounts();
  const journal = useJournal();
  const [open, setOpen] = React.useState(false);
  const totals = React.useMemo(() => (journal.data ? accountTotals(journal.data) : new Map()), [journal.data]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of (accounts.data ?? []).slice().sort((x, y) => x.code.localeCompare(y.code))) m.set(a.group, [...(m.get(a.group) ?? []), a]);
    return [...m];
  }, [accounts.data]);

  return (
    <>
      <PageHeader title="Chart of accounts" description="Every ledger account, grouped the Indian way. Sales, purchases and payments post here automatically." actions={can("accounting", "create") ? <Button variant="primary" onClick={() => setOpen(true)}>New account</Button> : undefined} />
      {accounts.isPending || journal.isPending ? <Panel><TableSkeleton rows={10} cols={4} /></Panel> : accounts.error || journal.error ? <ErrorState what="Accounts could not be loaded" blame="network" onRetry={() => { void accounts.refetch(); void journal.refetch(); }} /> : (
        <div className="space-y-4">
          {grouped.map(([group, list]) => (
            <Panel key={group}>
              <PanelHeader title={group} />
              <table className="w-full text-sm"><tbody>
                {list.map((a) => {
                  const bal = naturalBalance(a, totals.get(a.id));
                  return (
                    <tr key={a.id} className="border-b border-line last:border-0">
                      <td className="num w-20 px-4 py-2 text-muted">{a.code}</td>
                      <td className="px-2 py-2"><Link className="hover:underline" href={`/accounting/ledger/${a.id}`}>{a.name}</Link> {a.system ? <Badge className="ml-1">System</Badge> : null}</td>
                      <td className="px-4 py-2 text-right"><Money value={bal} /></td>
                    </tr>
                  );
                })}
              </tbody></table>
            </Panel>
          ))}
        </div>
      )}
      <AccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
