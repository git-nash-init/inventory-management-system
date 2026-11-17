"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/ui/surface";
import { LoadError } from "@/components/states/load-error";
import { PageSkeleton } from "@/components/states/skeletons";
import { saveShop, useAction } from "@/data/actions";
import { useShop } from "@/data/queries";
import type { Shop } from "@/data/types";
import { useI18n } from "@/lib/i18n";

export function ShopSettings() {
  const { t } = useI18n();
  const shop = useShop();
  return (
    <>
      <PageHeader title={t("shop.title")} description={t("shop.intro")} />
      {shop.isPending ? (
        <PageSkeleton />
      ) : shop.isError ? (
        <LoadError error={shop.error} onRetry={() => void shop.refetch()} />
      ) : (
        // Keyed on the saved values so the form refreshes after a save or a reload from the database.
        <ShopForm key={JSON.stringify(shop.data)} initial={shop.data} />
      )}
    </>
  );
}

function ShopForm({ initial }: { initial: Shop }) {
  const { t } = useI18n();
  const [form, setForm] = React.useState<Shop>(initial);
  const [nameError, setNameError] = React.useState<string>();
  const save = useAction(saveShop, { success: t("shop.saved") });

  const set = (k: keyof Shop) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setNameError(t("shop.errName"));
    setNameError(undefined);
    save.mutate(form);
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-4">
      <Panel className="space-y-4 p-4">
        <Field label={t("shop.name")} htmlFor="sh-name" error={nameError} required>
          <Input id="sh-name" value={form.name} onChange={set("name")} aria-invalid={Boolean(nameError)} className="h-11 text-base" />
        </Field>
        <Field label={`${t("shop.address")} ${t("common.optional")}`} htmlFor="sh-address">
          <Textarea id="sh-address" value={form.address} onChange={set("address")} rows={3} className="text-base" />
        </Field>
        <Field label={`${t("shop.phone")} ${t("common.optional")}`} htmlFor="sh-phone">
          <Input id="sh-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} className="h-11 text-base" />
        </Field>
      </Panel>

      <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">{t("shop.bankSection")}</h2>
        <Field label={t("shop.bankName")} htmlFor="sh-bank">
          <Input id="sh-bank" value={form.bankName} onChange={set("bankName")} className="h-11 text-base" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("shop.account")} htmlFor="sh-acc">
            <Input id="sh-acc" inputMode="numeric" value={form.accountNo} onChange={set("accountNo")} className="h-11 text-base" />
          </Field>
          <Field label={t("shop.ifsc")} htmlFor="sh-ifsc">
            <Input id="sh-ifsc" value={form.ifsc} onChange={set("ifsc")} className="h-11 text-base uppercase" />
          </Field>
        </div>
        <Field label={t("shop.upi")} htmlFor="sh-upi">
          <Input id="sh-upi" value={form.upiId} onChange={set("upiId")} className="h-11 text-base" />
        </Field>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="lg" disabled={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
