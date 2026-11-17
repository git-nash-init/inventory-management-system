"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel } from "@/components/ui/surface";
import { EmptyState } from "@/components/states/empty-state";
import { LoadError } from "@/components/states/load-error";
import { PageSkeleton } from "@/components/states/skeletons";
import { createBill, useAction } from "@/data/actions";
import { useProducts } from "@/data/queries";
import { calcBill, isValidMobile, parseNumber } from "@/lib/bill";
import { formatQty } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n";

type Row = { key: number; productId: string; qty: string; price: string };
type RowErrors = { product?: string; qty?: string; price?: string };

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, productId: "", qty: "", price: "" });

export function BillForm() {
  const { t, unit } = useI18n();
  const router = useRouter();
  const products = useProducts();
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>(() => [blankRow()]);
  const [gst, setGst] = React.useState("");
  const [errors, setErrors] = React.useState<{ mobile?: string; gst?: string; items?: string; rows: Record<number, RowErrors> }>({ rows: {} });

  const save = useAction(createBill, { success: t("bill.saved"), onDone: (id) => router.push(`/bills/${id}`) });

  const list = React.useMemo(() => products.data ?? [], [products.data]);
  const byId = React.useMemo(() => new Map(list.map((p) => [p.id, p])), [list]);

  const gstNumber = parseNumber(gst);
  const gstPercent = gstNumber !== null && gstNumber > 0 ? gstNumber : null;
  const filled = rows.filter((r) => byId.has(r.productId) && (parseNumber(r.qty) ?? 0) > 0 && parseNumber(r.price) !== null);
  const totals = calcBill(
    filled.map((r) => ({ qty: parseNumber(r.qty) ?? 0, price: parseNumber(r.price) ?? 0 })),
    gstPercent !== null && gstPercent <= 100 ? gstPercent : null,
  );

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function pickProduct(key: number, productId: string) {
    const p = byId.get(productId);
    update(key, { productId, price: p ? String(p.sellPrice) : "" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = { rows: {} };
    if (mobile.trim() && !isValidMobile(mobile)) next.mobile = t("bill.errMobile");
    if (gst.trim() && (gstNumber === null || gstNumber < 0 || gstNumber > 100)) next.gst = t("bill.errGst");

    const used = new Map<string, number>();
    const items: { productId: string; qty: number; price: number }[] = [];
    for (const r of rows) {
      const untouched = !r.productId && !r.qty.trim();
      if (untouched) continue;
      const re: RowErrors = {};
      const p = byId.get(r.productId);
      const qty = parseNumber(r.qty);
      const price = parseNumber(r.price);
      if (!p) re.product = t("bill.chooseProduct");
      if (qty === null || qty <= 0) re.qty = t("err.qtyMore0");
      if (price === null || price < 0) re.price = t("bill.errPrice");
      if (p && qty !== null && qty > 0) {
        const total = (used.get(p.id) ?? 0) + qty;
        used.set(p.id, total);
        if (total > p.quantity) re.qty = t("bill.errQtyLeft", { qty: formatQty(p.quantity), unit: unit(p.unit) });
      }
      if (re.product || re.qty || re.price) next.rows[r.key] = re;
      else if (p && qty !== null && price !== null) items.push({ productId: p.id, qty, price });
    }
    if (items.length === 0 && Object.keys(next.rows).length === 0) next.items = t("bill.errItems");
    setErrors(next);
    if (next.mobile || next.gst || next.items || Object.keys(next.rows).length > 0) return;

    save.mutate({ customerName: name.trim(), customerMobile: mobile.trim(), gstPercent, items });
  }

  if (products.isPending) return <PageSkeleton />;
  if (products.isError) return <LoadError error={products.error} onRetry={() => void products.refetch()} />;

  if (!list.some((p) => p.quantity > 0)) {
    return (
      <>
        <PageHeader title={t("bill.new")} />
        <Panel>
          <EmptyState
            icon={<Package size={36} />}
            title={t("bill.noProductsTitle")}
            reason={t("bill.noProductsText")}
            actionLabel={t("bill.goToStock")}
            actionHref="/stock"
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("bill.new")} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Panel className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label={`${t("bill.customerName")} ${t("common.optional")}`} htmlFor="b-name">
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="h-11 text-base" />
          </Field>
          <Field label={`${t("bill.mobile")} ${t("common.optional")}`} htmlFor="b-mobile" error={errors.mobile}>
            <Input id="b-mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} aria-invalid={Boolean(errors.mobile)} autoComplete="off" className="h-11 text-base" />
          </Field>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("bill.items")}</h2>
          <ul className="space-y-4">
            {rows.map((r) => {
              const p = byId.get(r.productId);
              const re = errors.rows[r.key] ?? {};
              const qty = parseNumber(r.qty);
              const price = parseNumber(r.price);
              const amount = qty !== null && price !== null && qty > 0 ? calcBill([{ qty, price }], null).subtotal : 0;
              return (
                <li key={r.key} className="grid gap-3 border-b border-line pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Field label={t("bill.product")} htmlFor={`b-p-${r.key}`} error={re.product}>
                    <NativeSelect id={`b-p-${r.key}`} value={r.productId} onChange={(e) => pickProduct(r.key, e.target.value)} aria-invalid={Boolean(re.product)} className="h-11 text-base">
                      <option value="">{t("bill.chooseProduct")}</option>
                      {list.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.quantity <= 0}>
                          {x.name} ({x.quantity > 0 ? t("bill.left", { qty: formatQty(x.quantity), unit: unit(x.unit) }) : t("bill.finished")})
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label={p ? `${t("bill.qty")} (${unit(p.unit)})` : t("bill.qty")} htmlFor={`b-q-${r.key}`} error={re.qty}>
                    <Input id={`b-q-${r.key}`} inputMode="decimal" value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} aria-invalid={Boolean(re.qty)} className="h-11 text-base" />
                  </Field>
                  <Field label={t("bill.price")} htmlFor={`b-r-${r.key}`} error={re.price}>
                    <Input id={`b-r-${r.key}`} inputMode="decimal" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} aria-invalid={Boolean(re.price)} className="h-11 text-base" />
                  </Field>
                  <div className="flex items-end justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs text-muted">{t("bill.amount")}</div>
                      <Money value={amount} className="text-base font-medium" />
                    </div>
                    {rows.length > 1 ? (
                      <Button variant="ghost" size="icon" aria-label={t("bill.removeRow")} title={t("bill.removeRow")} className="h-11 w-11 text-bad" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                        <Trash size={18} />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {errors.items ? (
            <p role="alert" className="mt-3 text-sm text-bad">
              {errors.items}
            </p>
          ) : null}
          <Button className="mt-4" size="lg" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus size={18} /> {t("bill.addItem")}
          </Button>
        </Panel>

        <Panel className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label={t("bill.gst")} htmlFor="b-gst" error={errors.gst}>
            <Input id="b-gst" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} placeholder="0" aria-invalid={Boolean(errors.gst)} className="h-11 max-w-40 text-base" />
          </Field>
          <dl className="space-y-1 text-sm sm:ml-auto sm:w-64">
            <div className="flex justify-between">
              <dt className="text-muted">{t("bill.subtotal")}</dt>
              <dd>
                <Money value={totals.subtotal} />
              </dd>
            </div>
            {gstPercent !== null && gstPercent <= 100 ? (
              <div className="flex justify-between">
                <dt className="text-muted">{t("bill.gstLine", { pct: gstPercent })}</dt>
                <dd>
                  <Money value={totals.gstAmount} />
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>{t("bill.total")}</dt>
              <dd>
                <Money value={totals.total} />
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/bills" className="inline-flex h-11 items-center rounded border border-line bg-surface px-5 text-base font-medium hover:bg-surface-2">
            {t("common.cancel")}
          </Link>
          <Button type="submit" variant="primary" size="lg" disabled={save.isPending}>
            {t("bill.save")}
          </Button>
        </div>
      </form>
    </>
  );
}
