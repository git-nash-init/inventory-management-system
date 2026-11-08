"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { getRepo } from "@/data";
import { errorMessage, useRepoMutation } from "@/data/hooks";
import { partySchema, type PartyForm } from "@/lib/validation/entities";
import { STATES } from "@/lib/gst/states";
import { validateGstin } from "@/lib/gst/gstin";
import type { Party } from "@/domain/types";

export function PartyDialog({
  open,
  onOpenChange,
  type,
  party,
  defaultState = "27",
  defaultName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: "customer" | "supplier";
  party?: Party;
  defaultState?: string;
  defaultName?: string;
  onSaved?: (p: Party) => void;
}) {
  const label = type === "customer" ? "customer" : "supplier";
  const form = useForm<PartyForm>({
    resolver: zodResolver(partySchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    values: party
      ? { name: party.name, gstin: party.gstin, stateCode: party.stateCode, phone: party.phone, email: party.email, address: party.address, creditLimit: party.creditLimit, creditDays: party.creditDays, openingBalance: party.openingBalance, priceList: party.priceList, active: party.active }
      : { name: defaultName, gstin: "", stateCode: defaultState, phone: "", email: "", address: "", creditLimit: 0, creditDays: type === "customer" ? 15 : 30, openingBalance: 0, priceList: "retail", active: true },
  });
  const { errors } = form.formState;
  const save = useRepoMutation((p: Omit<Party, "id"> & { id?: string }) => getRepo().parties.save(p));

  async function onSubmit(v: PartyForm) {
    try {
      const saved = await save.mutateAsync({ ...v, gstin: v.gstin.toUpperCase(), type, id: party?.id });
      toast.success(`${saved.name} saved`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field && m.field in v) form.setError(m.field as keyof PartyForm, { message: m.message });
      else toast.error(m.message);
    }
  }

  // Picking a valid GSTIN fills the state automatically.
  const gstin = form.watch("gstin");
  React.useEffect(() => {
    const r = validateGstin(gstin ?? "");
    if (r.valid) form.setValue("stateCode", r.stateCode, { shouldDirty: true });
  }, [gstin, form]);

  const reg = (name: keyof PartyForm, num = false) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `p-${name}-error` : undefined, ...form.register(name, num ? { valueAsNumber: true } : undefined) });
  const id = (n: string) => `p-${n}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={party ? `Edit ${label}` : `New ${label}`} description="Fields marked * are required." className="max-w-2xl">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor={id("name")} error={errors.name?.message} required className="sm:col-span-2"><Input id={id("name")} {...reg("name")} /></Field>
          <Field label="GSTIN" htmlFor={id("gstin")} error={errors.gstin?.message} hint="Leave empty for an unregistered party."><Input id={id("gstin")} className="num uppercase" maxLength={15} {...reg("gstin")} /></Field>
          <Field label="State (place of supply)" htmlFor={id("stateCode")} error={errors.stateCode?.message} required>
            <NativeSelect id={id("stateCode")} {...reg("stateCode")}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}</NativeSelect>
          </Field>
          <Field label="Phone" htmlFor={id("phone")} error={errors.phone?.message} hint="10 digit mobile, used for WhatsApp reminders."><Input id={id("phone")} inputMode="numeric" maxLength={10} className="num" {...reg("phone")} /></Field>
          <Field label="Email" htmlFor={id("email")} error={errors.email?.message}><Input id={id("email")} type="email" {...reg("email")} /></Field>
          <Field label="Address" htmlFor={id("address")} error={errors.address?.message} className="sm:col-span-2"><Textarea id={id("address")} rows={2} {...reg("address")} /></Field>
          <Field label="Credit limit" htmlFor={id("creditLimit")} error={errors.creditLimit?.message}><Input id={id("creditLimit")} type="number" step="any" {...reg("creditLimit", true)} /></Field>
          <Field label="Credit days" htmlFor={id("creditDays")} error={errors.creditDays?.message}><Input id={id("creditDays")} type="number" {...reg("creditDays", true)} /></Field>
          <Field
            label={type === "customer" ? "Opening balance (they owe you)" : "Opening balance (you owe them)"}
            htmlFor={id("openingBalance")} error={errors.openingBalance?.message}
            hint={party ? "Fixed after creation. Use a voucher to correct it." : "Enter a negative number for an advance."}
          >
            <Input id={id("openingBalance")} type="number" step="any" disabled={Boolean(party)} {...reg("openingBalance", true)} />
          </Field>
          {type === "customer" ? (
            <Field label="Price list" htmlFor={id("priceList")}><NativeSelect id={id("priceList")} {...reg("priceList")}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></NativeSelect></Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...form.register("active")} /> Active</label>
          <div className="flex justify-end gap-2 border-t border-line pt-3 sm:col-span-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving" : party ? "Save changes" : `Add ${label}`}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
