"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { addProduct, addStock, removeProduct, updateProduct, useAction } from "@/data/actions";
import type { Product } from "@/data/types";
import { parseNumber } from "@/lib/bill";
import { formatQty } from "@/lib/format/money";
import { UNITS, useI18n } from "@/lib/i18n";

type Errors = Record<string, string | undefined>;

/* ------------------------------------------------------------------ add / edit product */

export function ProductDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={product ? t("product.edit") : t("product.new")}>
        {/* Mounted only while open, so the form always starts from the current product. */}
        {open ? <ProductForm product={product} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const { t, unit } = useI18n();
  const [name, setName] = React.useState(product?.name ?? "");
  const [unitValue, setUnitValue] = React.useState(product?.unit ?? "kg");
  const [buy, setBuy] = React.useState(product ? String(product.buyPrice) : "");
  const [sell, setSell] = React.useState(product ? String(product.sellPrice) : "");
  const [low, setLow] = React.useState(product?.lowStockAt != null ? String(product.lowStockAt) : "");
  const [opening, setOpening] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const save = useAction(
    async (v: { name: string; unit: string; buyPrice: number; sellPrice: number; lowStockAt: number | null; openingQty: number }) => {
      if (product) await updateProduct(product.id, v);
      else await addProduct(v);
    },
    { success: product ? t("product.saved") : t("product.added"), onDone },
  );
  const remove = useAction(removeProduct, { success: t("product.removed"), onDone });

  const units = UNITS.includes(unitValue as (typeof UNITS)[number]) ? [...UNITS] : [...UNITS, unitValue];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const buyPrice = parseNumber(buy);
    const sellPrice = parseNumber(sell);
    const lowStockAt = parseNumber(low);
    const openingQty = parseNumber(opening);
    if (!name.trim()) next.name = t("product.errName");
    if (buyPrice === null || buyPrice < 0) next.buy = t("product.errPrice");
    if (sellPrice === null || sellPrice < 0) next.sell = t("product.errPrice");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({
      name,
      unit: unitValue,
      buyPrice: buyPrice ?? 0,
      sellPrice: sellPrice ?? 0,
      lowStockAt: lowStockAt !== null && lowStockAt >= 0 ? lowStockAt : null,
      openingQty: openingQty !== null && openingQty > 0 ? openingQty : 0,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label={t("product.name")} htmlFor="p-name" error={errors.name} required>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} autoFocus className="h-11 text-base" />
      </Field>
      <Field label={t("product.unit")} htmlFor="p-unit">
        <NativeSelect id="p-unit" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} className="h-11 text-base">
          {units.map((u) => (
            <option key={u} value={u}>
              {unit(u)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("product.buyPrice")} htmlFor="p-buy" error={errors.buy} required>
          <Input id="p-buy" inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} aria-invalid={Boolean(errors.buy)} className="h-11 text-base" />
        </Field>
        <Field label={t("product.sellPrice")} htmlFor="p-sell" error={errors.sell} required>
          <Input id="p-sell" inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} aria-invalid={Boolean(errors.sell)} className="h-11 text-base" />
        </Field>
      </div>
      {product ? null : (
        <Field label={t("product.openingQty")} htmlFor="p-open" hint={t("product.openingHint")}>
          <Input id="p-open" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} className="h-11 text-base" />
        </Field>
      )}
      <Field label={`${t("product.lowAt")} ${t("common.optional")}`} htmlFor="p-low" hint={t("product.lowAtHint")}>
        <Input id="p-low" inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} className="h-11 text-base" />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div>
          {product ? (
            confirmRemove ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-bad">{t("product.removeConfirm")}</span>
                <Button variant="danger" onClick={() => remove.mutate(product.id)} disabled={remove.isPending}>
                  {t("common.remove")}
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="text-bad" onClick={() => setConfirmRemove(true)}>
                {t("common.remove")}
              </Button>
            )
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={onDone} size="lg">
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ add stock */

export function AddStockDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("addStock.title", { name: product?.name ?? "" })}>
        {product ? <AddStockForm product={product} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddStockForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { t, unit } = useI18n();
  const [qty, setQty] = React.useState("");
  const [price, setPrice] = React.useState(String(product.buyPrice));
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const u = unit(product.unit);

  const save = useAction((v: { qty: number; price: number | null; note: string }) => addStock(product.id, v.qty, v.price, v.note), {
    success: t("addStock.done"),
    onDone,
  });

  const qtyNum = parseNumber(qty);
  const after = product.quantity + (qtyNum !== null && qtyNum > 0 ? qtyNum : 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseNumber(price);
    const next: Errors = {};
    if (qtyNum === null || qtyNum <= 0) next.qty = t("addStock.errQty");
    if (priceNum !== null && priceNum < 0) next.price = t("product.errPrice");
    setErrors(next);
    if (Object.keys(next).length > 0 || qtyNum === null) return;
    save.mutate({ qty: qtyNum, price: priceNum, note: note.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm text-muted">{t("addStock.now", { qty: `${formatQty(product.quantity)} ${u}` })}</p>
      <Field label={t("addStock.qty")} htmlFor="s-qty" error={errors.qty} required>
        <Input id="s-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={Boolean(errors.qty)} autoFocus className="h-11 text-base" />
      </Field>
      <Field label={t("addStock.price", { unit: u })} htmlFor="s-price" error={errors.price}>
        <Input id="s-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={Boolean(errors.price)} className="h-11 text-base" />
      </Field>
      <Field label={`${t("addStock.note")} ${t("common.optional")}`} htmlFor="s-note">
        <Input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-11 text-base" />
      </Field>
      <p className="text-sm font-medium">{t("addStock.after", { qty: `${formatQty(after)} ${u}` })}</p>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone} size="lg">
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ fix quantity */

export function FixQuantityDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("fix.title", { name: product?.name ?? "" })} description={t("fix.hint")}>
        {product ? <FixForm product={product} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function FixForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { t, unit } = useI18n();
  const [actual, setActual] = React.useState(String(product.quantity));
  const [error, setError] = React.useState<string>();
  const u = unit(product.unit);

  const save = useAction((diff: number) => addStock(product.id, diff, null, t("fix.note")), { success: t("fix.done"), onDone });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNumber(actual);
    if (n === null || n < 0) return setError(t("fix.errNumber"));
    const diff = Math.round((n - product.quantity) * 1000) / 1000;
    if (diff === 0) return setError(t("fix.errSame"));
    setError(undefined);
    save.mutate(diff);
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm text-muted">{t("addStock.now", { qty: `${formatQty(product.quantity)} ${u}` })}</p>
      <Field label={`${t("fix.actual")} (${u})`} htmlFor="f-actual" error={error} required>
        <Input id="f-actual" inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} aria-invalid={Boolean(error)} autoFocus className="h-11 text-base" />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone} size="lg">
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
