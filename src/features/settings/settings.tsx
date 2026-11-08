"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/surface";
import { DataTable } from "@/components/tables/data-table";
import { ErrorState } from "@/components/states/error-state";
import { getRepo } from "@/data";
import { errorMessage, useAudit, useBusiness, useRepoMutation, useTeam } from "@/data/hooks";
import { DEFAULT_PREFIXES } from "@/domain/engine";
import { ROLES, ROLE_LABEL, can as roleCan } from "@/domain/permissions";
import type { AuditEntry, Business, Member, Role } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { businessSchema, inviteSchema, type BusinessForm, type InviteForm } from "@/lib/validation/entities";
import { STATES } from "@/lib/gst/states";
import { readCheckedFile } from "@/lib/security/upload";
import { TYPE_LABEL } from "@/features/documents/config";
import { formatDate } from "@/lib/format/date";

function useSaveBusiness() {
  return useRepoMutation((b: Business) => getRepo().business.save(b));
}

function SettingsLoading({ q }: { q: { isPending: boolean; error: unknown; refetch: () => unknown } }) {
  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  if (q.error) return <ErrorState what="Settings could not be loaded" blame="network" onRetry={() => void q.refetch()} />;
  return null;
}

export function BusinessSettings() {
  const { can } = useAuth();
  const q = useBusiness();
  const save = useSaveBusiness();
  const editable = can("settings", "edit");
  const biz = q.data;
  const form = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema), mode: "onBlur", reValidateMode: "onChange",
    values: biz ? { name: biz.name, legalName: biz.legalName, gstin: biz.gstin, pan: biz.pan, stateCode: biz.stateCode, address: biz.address, city: biz.city, pincode: biz.pincode, phone: biz.phone, email: biz.email, bankName: biz.bankName, bankAccount: biz.bankAccount, ifsc: biz.ifsc, upiId: biz.upiId } : undefined,
  });
  const [logo, setLogo] = React.useState<string | undefined>();
  const [sig, setSig] = React.useState<string | undefined>();
  const [touched, setTouched] = React.useState({ logo: false, sig: false });
  const { errors } = form.formState;
  const stop = SettingsLoading({ q });
  if (stop) return stop;
  const b = biz!;
  const logoShown = touched.logo ? logo : b.logoDataUrl;
  const sigShown = touched.sig ? sig : b.signatureDataUrl;

  async function pick(kind: "logo" | "sig", f?: File) {
    if (!f) return;
    const r = await readCheckedFile(f, "image");
    if (!r.ok) return toast.error(r.message);
    if (kind === "logo") setLogo(r.dataUrl); else setSig(r.dataUrl);
    setTouched((t) => ({ ...t, [kind]: true }));
  }

  async function onSubmit(v: BusinessForm) {
    try {
      await save.mutateAsync({ ...b, ...v, logoDataUrl: logoShown, signatureDataUrl: sigShown });
      toast.success("Business details saved");
    } catch (e) {
      toast.error(errorMessage(e).message);
    }
  }

  const f = (n: keyof BusinessForm) => ({ disabled: !editable, "aria-invalid": Boolean(errors[n]), ...form.register(n) });
  return (
    <>
      <PageHeader title="Business" description="These details print on every invoice and decide how GST is split." />
      {!editable ? <p className="mb-3 rounded border border-line bg-surface-2 px-3 py-2 text-sm text-muted">You can view these details but only an owner can change them.</p> : null}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Panel className="mb-4"><PanelHeader title="Identity" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="bn" error={errors.name?.message} required><Input id="bn" {...f("name")} /></Field>
            <Field label="Legal name" htmlFor="bl" error={errors.legalName?.message}><Input id="bl" {...f("legalName")} /></Field>
            <Field label="GSTIN" htmlFor="bg" error={errors.gstin?.message} hint="Leave empty if you are not registered."><Input id="bg" className="num uppercase" maxLength={15} {...f("gstin")} /></Field>
            <Field label="PAN" htmlFor="bp" error={errors.pan?.message}><Input id="bp" className="num uppercase" maxLength={10} {...f("pan")} /></Field>
            <Field label="State" htmlFor="bs" error={errors.stateCode?.message} required hint="Your home state. Sales to other states charge IGST."><NativeSelect id="bs" {...f("stateCode")}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}</NativeSelect></Field>
            <Field label="Phone" htmlFor="bph" error={errors.phone?.message}><Input id="bph" inputMode="numeric" maxLength={10} className="num" {...f("phone")} /></Field>
            <Field label="Email" htmlFor="be" error={errors.email?.message}><Input id="be" type="email" {...f("email")} /></Field>
          </div>
        </Panel>
        <Panel className="mb-4"><PanelHeader title="Address" />
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <Field label="Street address" htmlFor="ba" error={errors.address?.message} className="sm:col-span-3"><Textarea id="ba" rows={2} disabled={!editable} {...form.register("address")} /></Field>
            <Field label="City" htmlFor="bc" error={errors.city?.message}><Input id="bc" {...f("city")} /></Field>
            <Field label="PIN code" htmlFor="bpin" error={errors.pincode?.message}><Input id="bpin" inputMode="numeric" maxLength={6} className="num" {...f("pincode")} /></Field>
          </div>
        </Panel>
        <Panel className="mb-4"><PanelHeader title="Bank and UPI (printed on invoices)" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Bank name" htmlFor="bb" error={errors.bankName?.message}><Input id="bb" {...f("bankName")} /></Field>
            <Field label="Account number" htmlFor="bac" error={errors.bankAccount?.message}><Input id="bac" inputMode="numeric" className="num" {...f("bankAccount")} /></Field>
            <Field label="IFSC" htmlFor="bi" error={errors.ifsc?.message}><Input id="bi" className="num uppercase" maxLength={11} {...f("ifsc")} /></Field>
            <Field label="UPI ID" htmlFor="bu" error={errors.upiId?.message} hint="Creates the Scan to pay QR on invoices."><Input id="bu" {...f("upiId")} /></Field>
          </div>
        </Panel>
        <Panel className="mb-4"><PanelHeader title="Logo and signature (PNG, JPG or WEBP, up to 2 MB)" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {([["logo", "Logo", logoShown], ["sig", "Signature", sigShown]] as const).map(([k, label, src]) => (
              <div key={k}>
                <p className="mb-1 text-xs font-medium text-muted">{label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src ? <img src={src} alt={`${label} preview`} height={56} className="mb-2 max-h-14 border border-line bg-white p-1" /> : null}
                {editable ? <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={label} onChange={(e) => void pick(k, e.target.files?.[0])} className="text-sm" /> : null}
                {editable && src ? <button type="button" className="link ml-3 text-sm" onClick={() => { if (k === "logo") setLogo(undefined); else setSig(undefined); setTouched((t) => ({ ...t, [k]: true })); }}>Remove</button> : null}
              </div>
            ))}
          </div>
        </Panel>
        {editable ? <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save changes"}</Button> : null}
      </form>
    </>
  );
}

export function InvoiceSettings() {
  const { can } = useAuth();
  const q = useBusiness();
  const save = useSaveBusiness();
  const editable = can("settings", "edit");
  const [draft, setDraft] = React.useState<Business>();
  const stop = SettingsLoading({ q });
  if (stop) return stop;
  const b = draft ?? q.data!;
  const patch = (p: Partial<Business>) => setDraft({ ...b, ...p });
  const series = Object.keys(DEFAULT_PREFIXES).filter((k) => !["receipt", "payment", "journal", "contra", "expense", "stock_adjustment", "opening"].includes(k));
  const bad = series.filter((k) => !/^[A-Z0-9-]{1,8}$/.test(b.prefixes[k] ?? DEFAULT_PREFIXES[k]));

  return (
    <>
      <PageHeader title="Invoice settings" description="Numbering, print format and default terms." />
      <Panel className="mb-4"><PanelHeader title="Print format" />
        <div className="p-4"><Field label="Default template" htmlFor="tpl"><NativeSelect id="tpl" disabled={!editable} value={b.invoiceTemplate} onChange={(e) => patch({ invoiceTemplate: e.target.value as Business["invoiceTemplate"] })}><option value="a4">A4</option><option value="a5">A5</option><option value="thermal">80 mm thermal receipt</option></NativeSelect></Field></div>
      </Panel>
      <Panel className="mb-4"><PanelHeader title="Number series" />
        <div className="p-4">
          <p className="mb-3 text-sm text-muted">Numbers look like <span className="num">INV/26-27/0001</span> and restart every 1 April. Change the prefix; the financial year and sequence are automatic.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {series.map((k) => {
              const label = k.startsWith("p:") ? `Purchase: ${TYPE_LABEL[k.slice(2)] ?? k}` : TYPE_LABEL[k] ?? k;
              const invalid = bad.includes(k);
              return (
                <Field key={k} label={label} htmlFor={`pre-${k}`} error={invalid ? "Use 1 to 8 capital letters, digits or dashes" : undefined}>
                  <Input id={`pre-${k}`} disabled={!editable} className="num uppercase" value={b.prefixes[k] ?? DEFAULT_PREFIXES[k]} onChange={(e) => patch({ prefixes: { ...b.prefixes, [k]: e.target.value.toUpperCase() } })} aria-invalid={invalid} />
                </Field>
              );
            })}
          </div>
        </div>
      </Panel>
      <Panel className="mb-4"><PanelHeader title="Terms and conditions" />
        <div className="p-4"><Textarea aria-label="Default terms" rows={4} disabled={!editable} value={b.terms} onChange={(e) => patch({ terms: e.target.value })} /></div>
      </Panel>
      {editable ? <Button variant="primary" disabled={!draft || bad.length > 0 || save.isPending} onClick={async () => { try { await save.mutateAsync(b); setDraft(undefined); toast.success("Invoice settings saved"); } catch (e) { toast.error(errorMessage(e).message); } }}>{save.isPending ? "Saving" : "Save changes"}</Button> : null}
    </>
  );
}

export function TaxSettings() {
  const { can } = useAuth();
  const q = useBusiness();
  const save = useSaveBusiness();
  const editable = can("settings", "edit");
  const [draft, setDraft] = React.useState<Business>();
  const stop = SettingsLoading({ q });
  if (stop) return stop;
  const b = draft ?? q.data!;
  const patch = (p: Partial<Business>) => setDraft({ ...b, ...p });
  return (
    <>
      <PageHeader title="Taxes" description="How your business is registered for GST." />
      <Panel className="mb-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GST scheme" htmlFor="scheme" hint={b.taxScheme === "composition" ? "Composition dealers cannot charge GST. Sales are issued as bills of supply with no tax." : "Regular: you charge GST on invoices and claim input credit."}>
            <NativeSelect id="scheme" disabled={!editable} value={b.taxScheme} onChange={(e) => patch({ taxScheme: e.target.value as Business["taxScheme"] })}><option value="regular">Regular</option><option value="composition">Composition</option></NativeSelect>
          </Field>
          <Field label="Default TCS % on sales" htmlFor="tcs" hint="Tax collected at source, if it applies to you. Usually 0."><Input id="tcs" type="number" step="any" min="0" max="100" disabled={!editable} className="num" value={b.tcsPct} onChange={(e) => patch({ tcsPct: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        </div>
        <p className="mt-4 text-xs text-muted">GST rates live on each product (0, 5, 12, 18 or 28 percent, plus cess). Place of supply on each document decides CGST and SGST versus IGST. Stock is valued at weighted average cost; the stock report also shows FIFO for comparison.</p>
      </Panel>
      {editable ? <Button variant="primary" disabled={!draft || save.isPending} onClick={async () => { try { await save.mutateAsync(b); setDraft(undefined); toast.success("Tax settings saved"); } catch (e) { toast.error(errorMessage(e).message); } }}>{save.isPending ? "Saving" : "Save changes"}</Button> : null}
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: { email: "", name: "", role: "sales" } });
  const invite = useRepoMutation((v: InviteForm) => getRepo().team.invite(v.email, v.name, v.role));
  const { errors } = form.formState;
  async function onSubmit(v: InviteForm) {
    try {
      await invite.mutateAsync(v);
      toast.success(`${v.email} added as ${ROLE_LABEL[v.role]}`);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field === "email") form.setError("email", { message: m.message });
      else toast.error(m.message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a team member" description="They sign in with this email and get the access of the role you choose.">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Email" htmlFor="ie" error={errors.email?.message} required><Input id="ie" type="email" {...form.register("email")} /></Field>
          <Field label="Name" htmlFor="in" error={errors.name?.message}><Input id="in" {...form.register("name")} /></Field>
          <Field label="Role" htmlFor="ir"><NativeSelect id="ir" {...form.register("role")}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</NativeSelect></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-3"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={invite.isPending}>{invite.isPending ? "Adding" : "Add member"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersSettings() {
  const { can, user, role: myRole } = useAuth();
  const q = useTeam();
  const [open, setOpen] = React.useState(false);
  const setRole = useRepoMutation((a: { id: string; role: Role }) => getRepo().team.setRole(a.id, a.role));
  const setActive = useRepoMutation((a: { id: string; active: boolean }) => getRepo().team.setActive(a.id, a.active));
  const editable = can("users", "edit");
  const columns: ColumnDef<Member, unknown>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <div><span className="font-medium">{row.original.name}</span> {row.original.email === user?.email ? <Badge className="ml-1">You</Badge> : null}<div className="text-xs text-muted">{row.original.email}</div></div> },
    { accessorKey: "role", header: "Role", cell: ({ row }) => editable ? (
      <NativeSelect aria-label={`Role for ${row.original.name}`} className="h-8 w-40" value={row.original.role} onChange={async (e) => { try { await setRole.mutateAsync({ id: row.original.id, role: e.target.value as Role }); toast.success("Role updated"); } catch (err) { toast.error(errorMessage(err).message); } }}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</NativeSelect>
    ) : ROLE_LABEL[row.original.role] },
    { accessorKey: "active", header: "Status", cell: ({ getValue }) => (getValue() ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>) },
    { id: "a", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => editable && row.original.role !== "owner" ? <button className="link text-xs" onClick={async () => { try { await setActive.mutateAsync({ id: row.original.id, active: !row.original.active }); } catch (err) { toast.error(errorMessage(err).message); } }}>{row.original.active ? "Deactivate" : "Reactivate"}</button> : null },
  ];
  return (
    <>
      <PageHeader title="Users and roles" description="Who can do what. Roles are enforced on the server and in the database." actions={editable ? <Button variant="primary" onClick={() => setOpen(true)}>Add member</Button> : undefined} />
      <DataTable columns={columns} data={q.data} isLoading={q.isPending} error={q.error} onRetry={() => void q.refetch()} noun="members" searchKeys={["name", "email"]} rowKey={(r) => r.id} empty={{ title: "No team members", reason: "Add the people who help run the business." }} />
      <Panel className="mt-5">
        <PanelHeader title="What each role can do" />
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted"><th className="px-3 py-2">Area</th>{ROLES.map((r) => <th key={r} className="px-3 py-2">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {(["dashboard", "inventory", "sales", "purchases", "accounting", "reports", "settings", "users"] as const).map((m) => (
              <tr key={m} className="border-b border-line last:border-0"><td className="px-3 py-2 capitalize">{m}</td>{ROLES.map((r) => <td key={r} className="px-3 py-2 text-muted">{(["view", "create", "edit", "delete"] as const).filter((a) => roleCan(r, m, a)).join(", ") || "none"}</td>)}</tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
      <p className="mt-4 text-sm text-muted">Your role: <strong className="text-ink">{ROLE_LABEL[myRole]}</strong>. Owners and accountants should turn on two-factor authentication: <Link className="link" href="/mfa">set it up</Link>.</p>
      <InviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ActivityLog() {
  const q = useAudit();
  const columns: ColumnDef<AuditEntry, unknown>[] = [
    { accessorKey: "at", header: "When", cell: ({ getValue }) => <span className="num">{formatDate(String(getValue()))} {new Date(String(getValue())).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span> },
    { accessorKey: "actor", header: "Who" },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "entity", header: "Item" },
    { accessorKey: "detail", header: "Detail" },
  ];
  return (
    <>
      <PageHeader title="Activity log" description="Who changed what, newest first. The log cannot be edited." />
      <DataTable columns={columns} data={q.data} isLoading={q.isPending} error={q.error} onRetry={() => void q.refetch()} noun="entries" searchKeys={["actor", "action", "detail", "entity"]} rowKey={(r) => r.id} empty={{ title: "No activity yet", reason: "Every create, edit and cancel is recorded here." }} />
    </>
  );
}
