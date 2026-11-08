"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Barcode, Camera } from "@phosphor-icons/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/forms/barcode-scanner";
import { BrowserPermissionDenied } from "@/components/states/permission-denied";
import { getRepo } from "@/data";
import { errorMessage, useRepoMutation } from "@/data/hooks";
import { productSchema, UNITS, type ProductForm } from "@/lib/validation/entities";
import { readCheckedFile } from "@/lib/security/upload";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { clearDraft, loadDraft } from "@/lib/drafts";
import type { Product, Variant } from "@/domain/types";

const blank: ProductForm = {
  name: "", sku: "", barcode: "", hsn: "", isService: false, gstRate: 18, cessPct: 0, unit: "PCS", altUnit: "", altFactor: undefined,
  mrp: 0, salePrice: 0, wholesalePrice: 0, purchasePrice: 0, openingStock: 0, reorderLevel: 0, category: "", brand: "",
  trackBatch: false, trackSerial: false, variantsText: "", active: true,
};

function toForm(p: Product): ProductForm {
  return {
    name: p.name, sku: p.sku, barcode: p.barcode, hsn: p.hsn, isService: p.isService, gstRate: p.gstRate, cessPct: p.cessPct, unit: p.unit,
    altUnit: p.altUnit ?? "", altFactor: p.altFactor, mrp: p.mrp, salePrice: p.salePrice, wholesalePrice: p.wholesalePrice,
    purchasePrice: p.purchasePrice, openingStock: p.openingStock, reorderLevel: p.reorderLevel, category: p.category, brand: p.brand,
    trackBatch: p.trackBatch, trackSerial: p.trackSerial, variantsText: p.variants.map((v) => v.name).join(", "), active: p.active,
  };
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  prefill,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product;
  prefill?: Partial<ProductForm>;
  categories: string[];
  onSaved?: (p: Product) => void;
}) {
  const editing = Boolean(product);
  const draftKey = `product:${product?.id ?? "new"}`;
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    values: product ? toForm(product) : { ...blank, ...prefill },
  });
  const { errors } = form.formState;
  const [image, setImage] = React.useState<string | undefined>(product?.imageUrl);
  const [fileDenied, setFileDenied] = React.useState(false);
  const [scan, setScan] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const watched = form.watch();
  const save = useRepoMutation((p: Parameters<ReturnType<typeof getRepo>["products"]["save"]>[0]) => getRepo().products.save(p));
  const isService = watched.isService;

  useAutosaveDraft(draftKey, watched, open && form.formState.isDirty);

  React.useEffect(() => {
    if (!open || editing) return;
    void loadDraft<ProductForm>(draftKey).then((d) => {
      if (d && !restored) {
        form.reset(d.data);
        setRestored(true);
        toast.message("Restored your unsaved product draft");
      }
    });
  }, [open, editing, draftKey, form, restored]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const res = await readCheckedFile(file, "image");
      if (!res.ok) return toast.error(res.message);
      setImage(res.dataUrl);
    } catch {
      setFileDenied(true);
    }
  }

  async function onSubmit(v: ProductForm) {
    const names = v.variantsText.split(",").map((s) => s.trim()).filter(Boolean);
    const variants: Variant[] = names.map((name) => {
      const existing = product?.variants.find((x) => x.name.toLowerCase() === name.toLowerCase());
      return existing ?? { id: crypto.randomUUID(), name, sku: v.sku ? `${v.sku}-${name}` : "", barcode: "" };
    });
    const { variantsText, altUnit, altFactor, ...rest } = v;
    void variantsText;
    try {
      const saved = await save.mutateAsync({
        ...(product ?? {}),
        ...rest,
        altUnit: altUnit || undefined,
        altFactor: altUnit ? altFactor : undefined,
        imageUrl: image,
        variants,
        id: product?.id,
        openingStock: isService ? 0 : rest.openingStock,
      } as never);
      await clearDraft(draftKey);
      toast.success(`${saved.name} saved`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field && m.field in v) form.setError(m.field as keyof ProductForm, { message: m.message });
      else toast.error(m.message);
    }
  }

  const reg = (name: keyof ProductForm, num = false) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `${name}-error` : undefined, ...form.register(name, num ? { valueAsNumber: true } : undefined) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? "Edit product" : "New product"} description="Fields marked * are required." className="max-w-2xl">
        <form
          onSubmit={form.handleSubmit(onSubmit, (errs) => {
            const first = Object.entries(errs)[0];
            toast.error(first ? `${String(first[1]?.message ?? "Fix the highlighted fields")}` : "Fix the highlighted fields");
          })}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
              <Input id="name" {...reg("name")} />
            </Field>
            <Field label="SKU" htmlFor="sku" error={errors.sku?.message}>
              <Input id="sku" className="num" {...reg("sku")} />
            </Field>
            <Field label="Barcode" htmlFor="barcode" error={errors.barcode?.message}>
              <div className="flex gap-2">
                <Input id="barcode" className="num" {...reg("barcode")} />
                <Button onClick={() => setScan(true)} aria-label="Scan barcode with camera" size="icon">
                  <Camera size={16} />
                </Button>
                <Button
                  onClick={() => form.setValue("barcode", String(Date.now()).slice(-12), { shouldDirty: true })}
                  aria-label="Generate a barcode number"
                  size="icon"
                >
                  <Barcode size={16} />
                </Button>
              </div>
            </Field>
            <Field label="HSN or SAC" htmlFor="hsn" error={errors.hsn?.message} hint="4, 6 or 8 digits">
              <Input id="hsn" className="num" inputMode="numeric" {...reg("hsn")} />
            </Field>
            <Field label="GST rate" htmlFor="gstRate" error={errors.gstRate?.message} required>
              <NativeSelect id="gstRate" {...reg("gstRate", true)}>
                {[0, 5, 12, 18, 28].map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Cess %" htmlFor="cessPct" error={errors.cessPct?.message}>
              <Input id="cessPct" type="number" step="any" {...reg("cessPct", true)} />
            </Field>
            <Field label="Unit" htmlFor="unit" error={errors.unit?.message} required>
              <NativeSelect id="unit" {...reg("unit")}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Alternate unit" htmlFor="altUnit" hint="Optional, like BOX of 12 PCS">
              <div className="flex gap-2">
                <NativeSelect id="altUnit" {...reg("altUnit")}>
                  <option value="">None</option>
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </NativeSelect>
                <Input type="number" step="any" placeholder="Qty in base unit" aria-label="Quantity of base unit in one alternate unit" {...form.register("altFactor", { setValueAs: (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v)) })} />
              </div>
            </Field>
            <Field label="MRP" htmlFor="mrp" error={errors.mrp?.message}>
              <Input id="mrp" type="number" step="any" {...reg("mrp", true)} />
            </Field>
            <Field label="Sale price (before tax)" htmlFor="salePrice" error={errors.salePrice?.message} required>
              <Input id="salePrice" type="number" step="any" {...reg("salePrice", true)} />
            </Field>
            <Field label="Wholesale price" htmlFor="wholesalePrice" error={errors.wholesalePrice?.message}>
              <Input id="wholesalePrice" type="number" step="any" {...reg("wholesalePrice", true)} />
            </Field>
            <Field label="Purchase price (before tax)" htmlFor="purchasePrice" error={errors.purchasePrice?.message}>
              <Input id="purchasePrice" type="number" step="any" {...reg("purchasePrice", true)} />
            </Field>
            {isService ? null : (
              <>
                <Field label="Opening stock" htmlFor="openingStock" error={errors.openingStock?.message} hint={editing ? "Fixed after creation. Use an adjustment to change stock." : "Goes into the default warehouse."}>
                  <Input id="openingStock" type="number" step="any" disabled={editing} {...reg("openingStock", true)} />
                </Field>
                <Field label="Reorder level" htmlFor="reorderLevel" error={errors.reorderLevel?.message} hint="You are alerted at or below this quantity.">
                  <Input id="reorderLevel" type="number" step="any" {...reg("reorderLevel", true)} />
                </Field>
              </>
            )}
            <Field label="Category" htmlFor="category">
              <Input id="category" list="category-list" {...reg("category")} />
              <datalist id="category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Brand" htmlFor="brand">
              <Input id="brand" {...reg("brand")} />
            </Field>
            <Field label="Variants" htmlFor="variantsText" hint="Comma separated, like S, M, L. Leave empty for none." className="sm:col-span-2">
              <Input id="variantsText" {...reg("variantsText")} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register("isService")} /> This is a service</label>
            {isService ? null : (
              <>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("trackBatch")} /> Track batch and expiry</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("trackSerial")} /> Track serial numbers</label>
              </>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register("active")} /> Active</label>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted">Image (PNG, JPG or WEBP, up to 2 MB)</p>
            {fileDenied ? (
              <BrowserPermissionDenied kind="files" />
            ) : (
              <div className="flex items-center gap-3">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="Product" width={56} height={56} className="h-14 w-14 border border-line object-cover" />
                ) : null}
                <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Product image" onChange={(e) => void onFile(e.target.files?.[0])} className="text-sm" />
                {image ? (
                  <button type="button" className="link text-sm" onClick={() => setImage(undefined)}>
                    Remove
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? "Saving" : editing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
        <BarcodeScanner open={scan} onOpenChange={setScan} onCode={(c) => form.setValue("barcode", c, { shouldDirty: true, shouldValidate: true })} />
      </DialogContent>
    </Dialog>
  );
}
