"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/surface";
import { ProductCombobox } from "@/components/forms/product-combobox";
import { SuccessPanel } from "@/components/states/success-panel";
import { ErrorState } from "@/components/states/error-state";
import { getRepo } from "@/data";
import { errorMessage, useBusiness, useMovements, useParties, useProducts, useRepoMutation, useWarehouses } from "@/data/hooks";
import { computeDocTotals } from "@/domain/engine";
import { batchesOn, qtyOn } from "@/domain/reports";
import type { Doc, DocInput, DocItem, DocType, Party, Product } from "@/domain/types";
import { calcLine } from "@/lib/gst/calc";
import { STATES, stateName } from "@/lib/gst/states";
import { amountInWords, formatQty } from "@/lib/format/money";
import { addDays, toISODate } from "@/lib/format/date";
import { readCheckedFile } from "@/lib/security/upload";
import { clearDraft, loadDraft, saveDraft } from "@/lib/drafts";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { PartyDialog } from "@/features/parties/party-dialog";
import { TYPE_LABEL, basePath, docHref, routeForDoc, type DocRoute } from "./config";
import { whatsappLink } from "./share";

type Line = DocItem & { key: string };

type FormState = {
  type: DocType;
  partyId: string;
  date: string;
  dueDate: string;
  place: string;
  warehouseId: string;
  reverseCharge: boolean;
  supplierInvoiceNo: string;
  notes: string;
  terms: string;
  tcsPct: number;
  lines: Line[];
  attachmentName?: string;
  attachmentDataUrl?: string;
};

const newKey = () => crypto.randomUUID();

function lineFromProduct(p: Product, kind: "sales" | "purchase", party?: Party): Line {
  const v = p.variants[0];
  const sale = party?.priceList === "wholesale" && p.wholesalePrice > 0 ? p.wholesalePrice : p.salePrice;
  const rate = kind === "purchase" ? p.purchasePrice : v?.salePrice ?? sale;
  return {
    key: newKey(), productId: p.id, variantId: v?.id, name: p.name, hsn: p.hsn, qty: 1, unit: p.unit, rate, discountPct: 0, gstRate: p.gstRate, cessPct: p.cessPct,
  };
}

export function DocumentEditor({
  route,
  type: initialType,
  initial,
  title,
  defaultPartyId,
}: {
  route: DocRoute;
  type: DocType;
  initial?: Doc;
  title?: string;
  defaultPartyId?: string;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const kind = route.kind;
  const business = useBusiness();
  const products = useProducts();
  const parties = useParties();
  const warehouses = useWarehouses();
  const movements = useMovements();
  const today = toISODate(new Date());
  const draftKey = `doc:${kind}:${initialType}:${initial?.id ?? "new"}`;

  const [form, setForm] = React.useState<FormState | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState<Doc>();
  const [partyOpen, setPartyOpen] = React.useState(false);
  const [fileMsg, setFileMsg] = React.useState<string>();
  const create = useRepoMutation((i: DocInput) => getRepo().docs.create(i));

  // Initialise once data is ready (from a converted/returned document, a saved draft, or blank).
  React.useEffect(() => {
    if (form || !business.data || !warehouses.data || !parties.data) return;
    const biz = business.data;
    const defaultWh = warehouses.data.find((w) => w.isDefault)?.id ?? warehouses.data[0]?.id ?? "";
    const base: FormState = initial
      ? {
          type: initialType, partyId: initial.partyId ?? "", date: today, dueDate: initial.dueDate ?? "", place: initial.placeOfSupply, warehouseId: initial.warehouseId,
          reverseCharge: initial.reverseCharge, supplierInvoiceNo: "", notes: initial.notes, terms: initial.terms, tcsPct: initial.tcsPct,
          lines: initial.items.map((i) => ({ ...i, key: newKey() })),
        }
      : {
          type: initialType, partyId: "", date: today, dueDate: "", place: biz.stateCode, warehouseId: defaultWh, reverseCharge: false, supplierInvoiceNo: "",
          notes: "", terms: kind === "sales" ? biz.terms : "", tcsPct: kind === "sales" ? biz.tcsPct : 0, lines: [],
        };
    const dp = !initial && defaultPartyId ? parties.data.find((p) => p.id === defaultPartyId) : undefined;
    if (dp) {
      base.partyId = dp.id;
      base.place = dp.stateCode;
      base.dueDate = dp.creditDays > 0 ? toISODate(addDays(new Date(base.date), dp.creditDays)) : base.date;
    }
    let cancelled = false;
    void loadDraft<FormState>(draftKey).then((d) => {
      if (cancelled) return;
      if (d && !initial) {
        setForm({ ...base, ...d.data, type: initialType });
        toast.message(d.queued ? "Loaded a draft that is waiting to be submitted" : "Restored your unsaved draft");
      } else setForm(base);
    });
    return () => {
      cancelled = true;
    };
  }, [form, business.data, warehouses.data, parties.data, defaultPartyId, initial, initialType, kind, today, draftKey]);

  useAutosaveDraft(draftKey, form, Boolean(form) && !saved);

  if (business.error || products.error || parties.error) return <ErrorState what="This form could not be prepared" blame="network" onRetry={() => { void business.refetch(); void products.refetch(); void parties.refetch(); }} />;
  if (!form || !business.data || !products.data || !parties.data || !warehouses.data || !movements.data) return <div aria-busy="true"><Skeleton className="mb-3 h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;

  const biz = business.data;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const partyType = kind === "sales" ? "customer" : "supplier";
  const partyList = parties.data.filter((p) => p.type === partyType && p.active);
  const party = parties.data.find((p) => p.id === form.partyId);
  const supply = form.place === biz.stateCode ? "intra" : "inter";
  const noTax = (kind === "sales" && ["bill_of_supply", "export_invoice"].includes(form.type)) || (kind === "sales" && biz.taxScheme === "composition");
  const totals = computeDocTotals(biz, { items: form.lines, kind, type: form.type, tcsPct: form.tcsPct }, supply);
  const allowWalkIn = kind === "sales" && ["invoice", "bill_of_supply"].includes(form.type);
  const checksStock = kind === "sales" && ["invoice", "bill_of_supply", "export_invoice"].includes(form.type) || (kind === "purchase" && form.type === "debit_note");

  function pickParty(id: string) {
    const p = parties.data?.find((x) => x.id === id);
    setForm((f) => {
      if (!f) return f;
      const due = p && p.creditDays > 0 ? toISODate(addDays(new Date(f.date), p.creditDays)) : f.date;
      return { ...f, partyId: id, place: p?.stateCode ?? f.place, dueDate: kind === "sales" || kind === "purchase" ? due : "" };
    });
  }

  function addProduct(p: Product) {
    setForm((f) => (f ? { ...f, lines: [...f.lines, lineFromProduct(p, kind, party)] } : f));
    setErrors((e) => ({ ...e, items: "" }));
  }
  const patchLine = (key: string, patch: Partial<Line>) => setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : f));
  const removeLine = (key: string) => setForm((f) => (f ? { ...f, lines: f.lines.filter((l) => l.key !== key) } : f));

  async function onFile(file: File | undefined) {
    if (!file) return;
    const res = await readCheckedFile(file, "document");
    if (!res.ok) return setFileMsg(res.message);
    setFileMsg(undefined);
    setForm((f) => (f ? { ...f, attachmentName: res.name, attachmentDataUrl: res.dataUrl } : f));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form) return e;
    if (!form.partyId && !allowWalkIn) e.partyId = `Choose a ${route.partyLabel.toLowerCase()}`;
    if (!form.date) e.date = "Choose a date";
    if (!form.warehouseId) e.warehouseId = "Choose a warehouse";
    if (form.lines.length === 0) e.items = "Add at least one item";
    if (kind === "purchase" && form.type === "bill" && !form.supplierInvoiceNo.trim()) e.supplierInvoiceNo = "Enter the supplier's invoice number";
    if (form.dueDate && form.dueDate < form.date) e.dueDate = "Due date cannot be before the document date";
    for (const [i, l] of form.lines.entries()) {
      if (!(l.qty > 0)) e.items = `Row ${i + 1}: quantity must be more than 0`;
      else if (l.rate < 0 || Number.isNaN(l.rate)) e.items = `Row ${i + 1}: rate must be a number`;
      else if (l.discountPct < 0 || l.discountPct > 100) e.items = `Row ${i + 1}: discount must be between 0 and 100`;
    }
    return e;
  }

  async function submit(status: "draft" | "final") {
    if (!form) return;
    const v = status === "final" ? validate() : {};
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Fix the highlighted fields first");
      return;
    }
    const input: DocInput = {
      id: initial && initial.status === "draft" ? initial.id : undefined,
      kind, type: form.type, date: form.date, dueDate: form.dueDate || undefined,
      partyId: form.partyId || undefined, partyName: party?.name ?? "Walk-in customer", partyGstin: party?.gstin ?? "",
      placeOfSupply: form.place, reverseCharge: form.reverseCharge, items: form.lines.map(({ key, ...rest }) => (void key, rest)),
      tcsPct: form.tcsPct, notes: form.notes, terms: form.terms, warehouseId: form.warehouseId,
      supplierInvoiceNo: form.supplierInvoiceNo || undefined, attachmentName: form.attachmentName, attachmentDataUrl: form.attachmentDataUrl, status,
      refDocId: initial?.id && initial.status !== "draft" ? initial.id : undefined,
    };
    if (!online) {
      await saveDraft(draftKey, form, { queued: true });
      toast.warning("You are offline. The document is saved on this device and can be submitted when you are back online.");
      return;
    }
    try {
      const doc = await create.mutateAsync(input);
      await clearDraft(draftKey);
      setSaved(doc);
      toast.success(status === "draft" ? "Draft saved" : `${doc.number} saved`);
    } catch (e) {
      const m = errorMessage(e);
      if (m.field) setErrors({ [m.field]: m.message });
      if (m.blame === "network") await saveDraft(draftKey, form, { queued: true });
      toast.error(m.message);
    }
  }

  if (saved) {
    const route2 = routeForDoc(saved.kind, saved.type) ?? route;
    const wa = saved.status !== "draft" && party?.phone ? whatsappLink(saved, biz, party.phone) : undefined;
    return (
      <div className="mx-auto max-w-2xl">
        <SuccessPanel
          title={saved.status === "draft" ? "Draft saved" : `${TYPE_LABEL[saved.type]} ${saved.number} saved`}
          detail={saved.status === "draft" ? "Nothing has been posted to stock or books yet. Open the draft to finish and issue it." : `${saved.partyName}, total ${amountInWords(saved.totals.grandTotal)}.`}
          steps={[
            { label: saved.status === "draft" ? "Continue editing" : "View and print", href: docHref(saved.kind, saved.type, saved.id) },
            ...(wa ? [{ label: "Share on WhatsApp", onClick: () => window.open(wa, "_blank", "noopener,noreferrer") }] : []),
            ...(saved.status !== "draft" && saved.partyId && ["invoice", "bill_of_supply", "export_invoice", "bill"].includes(saved.type) ? [{ label: "Record payment", href: `${basePath(saved.kind)}/payments?new=1&party=${saved.partyId}&doc=${saved.id}` }] : []),
            { label: `New ${route2.singular}`, onClick: () => { setSaved(undefined); setForm(null); router.refresh(); } },
            { label: `All ${route2.title.toLowerCase()}`, href: `${basePath(saved.kind)}/${route2.segment}` },
          ]}
        />
      </div>
    );
  }

  const err = (k: string) => errors[k] || undefined;
  const typeOptions = route.types;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title ?? `New ${TYPE_LABEL[form.type].toLowerCase()}`}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {kind === "sales" ? "Stock goes down and the books update when you issue it." : form.type === "bill" ? "Stock goes up and input tax credit is recorded when you save it." : "Saved as a document. It does not change stock or books until it is turned into a bill."}
          </p>
        </div>
        <Link href={`${basePath(kind)}/${route.segment}`} className="link text-sm">Cancel</Link>
      </div>

      <Panel className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          {typeOptions.length > 1 ? (
            <Field label="Document type" htmlFor="dtype">
              <NativeSelect id="dtype" value={form.type} onChange={(e) => set("type", e.target.value as DocType)}>
                {typeOptions.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label={route.partyLabel} htmlFor="dparty" error={err("partyId")} required={!allowWalkIn} className="md:col-span-2">
            <div className="flex gap-2">
              <NativeSelect id="dparty" value={form.partyId} onChange={(e) => pickParty(e.target.value)} aria-invalid={Boolean(err("partyId"))}>
                <option value="">{allowWalkIn ? "Walk-in customer (cash sale)" : `Choose a ${route.partyLabel.toLowerCase()}`}</option>
                {partyList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
              <Button onClick={() => setPartyOpen(true)} aria-label={`Add a new ${route.partyLabel.toLowerCase()}`}><Plus size={16} /></Button>
            </div>
            {party ? <p className="mt-1 text-xs text-muted">{party.gstin ? `GSTIN ${party.gstin}` : "Unregistered"} · {stateName(party.stateCode)}{party.creditDays ? ` · ${party.creditDays} days credit` : ""}</p> : null}
          </Field>
          <Field label="Date" htmlFor="ddate" error={err("date")} required><Input id="ddate" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
          {kind === "purchase" && form.type === "bill" ? (
            <Field label="Supplier invoice no." htmlFor="dsup" error={err("supplierInvoiceNo")} required><Input id="dsup" value={form.supplierInvoiceNo} onChange={(e) => set("supplierInvoiceNo", e.target.value)} aria-invalid={Boolean(err("supplierInvoiceNo"))} /></Field>
          ) : null}
          {["invoice", "bill_of_supply", "export_invoice", "bill"].includes(form.type) ? (
            <Field label="Due date" htmlFor="ddue" error={err("dueDate")}><Input id="ddue" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
          ) : null}
          <Field label="Place of supply" htmlFor="dplace" hint={noTax ? "No tax is charged on this document." : supply === "intra" ? "Same state: CGST and SGST" : "Different state: IGST"}>
            <NativeSelect id="dplace" value={form.place} onChange={(e) => set("place", e.target.value)}>
              {STATES.map((s) => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Warehouse" htmlFor="dwh" error={err("warehouseId")} required>
            <NativeSelect id="dwh" value={form.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
              {warehouses.data.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.reverseCharge} onChange={(e) => set("reverseCharge", e.target.checked)} /> Reverse charge applies</label>
        </div>
      </Panel>

      <Panel className="mb-4">
        <PanelHeader title="Items" />
        <div className="border-b border-line p-3">
          <ProductCombobox products={products.data} onPick={addProduct} stock={(p) => qtyOn(movements.data, p.id, undefined, form.warehouseId)} autoFocus={false} />
          {err("items") ? <p role="alert" className="mt-1 text-xs text-bad">{err("items")}</p> : null}
        </div>
        {form.lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No items yet. Search above, or scan a barcode and press Enter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                  <th className="px-3 py-2">Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">Disc %</th><th className="px-2 py-2 text-right">GST %</th><th className="px-3 py-2 text-right">Amount</th><th className="w-8 px-2 py-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, idx) => {
                  const prod = products.data.find((p) => p.id === l.productId);
                  const r = calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, cessPct: l.cessPct }, supply, { noTax });
                  const avail = prod && !prod.isService ? qtyOn(movements.data, l.productId, l.variantId, form.warehouseId) : undefined;
                  const over = checksStock && avail !== undefined && l.qty > avail;
                  const batches = prod?.trackBatch && checksStock ? batchesOn(movements.data, l.productId, l.variantId, form.warehouseId) : [];
                  return (
                    <tr key={l.key} className="border-b border-line align-top last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted">HSN {l.hsn || "none"}{avail !== undefined ? ` · ${formatQty(avail)} ${l.unit} in stock` : ""}</div>
                        {prod && prod.variants.length ? (
                          <NativeSelect aria-label={`Variant for ${l.name}`} className="mt-1 h-8 w-40 text-xs" value={l.variantId ?? ""} onChange={(e) => patchLine(l.key, { variantId: e.target.value || undefined })}>
                            {prod.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </NativeSelect>
                        ) : null}
                        {prod?.trackBatch && kind === "purchase" && form.type === "bill" ? (
                          <div className="mt-1 flex gap-2">
                            <Input aria-label={`Batch number for ${l.name}`} placeholder="Batch no." className="h-8 w-28 text-xs" value={l.batchNo ?? ""} onChange={(e) => patchLine(l.key, { batchNo: e.target.value })} />
                            <Input aria-label={`Expiry date for ${l.name}`} type="date" className="h-8 w-36 text-xs" value={l.expiry ?? ""} onChange={(e) => patchLine(l.key, { expiry: e.target.value })} />
                          </div>
                        ) : null}
                        {batches.length > 0 ? (
                          <NativeSelect aria-label={`Batch for ${l.name}`} className="mt-1 h-8 w-56 text-xs" value={l.batchNo ?? ""} onChange={(e) => patchLine(l.key, { batchNo: e.target.value || undefined })}>
                            <option value="">Earliest expiry first (automatic)</option>
                            {batches.map((b) => <option key={b.batchNo} value={b.batchNo}>{b.batchNo} · {formatQty(b.qty)} · exp {b.expiry ?? "none"}</option>)}
                          </NativeSelect>
                        ) : null}
                        {over ? <p role="alert" className="mt-1 text-xs text-bad">Only {formatQty(avail ?? 0)} {l.unit} available here.</p> : null}
                      </td>
                      <td className="px-2 py-2"><Input aria-label={`Quantity for row ${idx + 1}`} type="number" step="any" min="0" className="num h-8 w-20 text-right" value={Number.isNaN(l.qty) ? "" : l.qty} onChange={(e) => patchLine(l.key, { qty: e.target.valueAsNumber })} /></td>
                      <td className="px-2 py-2"><Input aria-label={`Rate for row ${idx + 1}`} type="number" step="any" min="0" className="num h-8 w-24 text-right" value={Number.isNaN(l.rate) ? "" : l.rate} onChange={(e) => patchLine(l.key, { rate: e.target.valueAsNumber })} /></td>
                      <td className="px-2 py-2"><Input aria-label={`Discount percent for row ${idx + 1}`} type="number" step="any" min="0" max="100" className="num h-8 w-16 text-right" value={Number.isNaN(l.discountPct) ? "" : l.discountPct} onChange={(e) => patchLine(l.key, { discountPct: e.target.valueAsNumber || 0 })} /></td>
                      <td className="px-2 py-2 text-right">
                        <NativeSelect aria-label={`GST rate for row ${idx + 1}`} className="num h-8 w-20" disabled={noTax} value={noTax ? 0 : l.gstRate} onChange={(e) => patchLine(l.key, { gstRate: Number(e.target.value) })}>
                          {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
                        </NativeSelect>
                      </td>
                      <td className="px-3 py-2 text-right"><Money value={r.total} /><div className="text-xs text-muted">tax <Money value={r.cgst + r.sgst + r.igst + r.cess} symbol={false} /></div></td>
                      <td className="px-2 py-2"><button type="button" onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name}`} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-bad"><Trash size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel className="p-4">
          <div className="grid gap-3">
            <Field label="Notes" htmlFor="dnotes"><Textarea id="dnotes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Field label="Terms and conditions" htmlFor="dterms"><Textarea id="dterms" rows={3} value={form.terms} onChange={(e) => set("terms", e.target.value)} /></Field>
            {kind === "purchase" && form.type === "bill" ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Scanned supplier bill (PDF, PNG or JPG, up to 5 MB)</p>
                <input type="file" accept="application/pdf,image/png,image/jpeg" aria-label="Scanned supplier bill" onChange={(e) => void onFile(e.target.files?.[0])} className="text-sm" />
                {form.attachmentName ? <p className="mt-1 text-xs text-ok">Attached: {form.attachmentName}</p> : null}
                {fileMsg ? <p role="alert" className="mt-1 text-xs text-bad">{fileMsg}</p> : null}
              </div>
            ) : null}
          </div>
        </Panel>
        <Panel className="p-4">
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.discount ? <Row label="Discount" value={-totals.discount} /> : null}
            <Row label="Taxable value" value={totals.taxable} />
            {supply === "intra" && !noTax ? (<><Row label="CGST" value={totals.cgst} /><Row label="SGST" value={totals.sgst} /></>) : null}
            {supply === "inter" && !noTax ? <Row label="IGST" value={totals.igst} /> : null}
            {totals.cess ? <Row label="Cess" value={totals.cess} /> : null}
            {kind === "sales" ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">TCS %</dt>
                <dd><Input aria-label="TCS percent" type="number" step="any" min="0" className="num h-8 w-20 text-right" value={form.tcsPct} onChange={(e) => set("tcsPct", e.target.valueAsNumber || 0)} /></dd>
              </div>
            ) : null}
            {totals.tcs ? <Row label="TCS" value={totals.tcs} /> : null}
            <Row label="Round off" value={totals.roundOff} />
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd><Money value={totals.grandTotal} /></dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">{amountInWords(totals.grandTotal)}</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button onClick={() => void submit("draft")} disabled={create.isPending}>Save draft</Button>
            <Button variant="primary" onClick={() => void submit("final")} disabled={create.isPending}>
              {create.isPending ? "Saving" : form.type === "invoice" || form.type === "bill" ? "Issue and save" : "Save"}
            </Button>
          </div>
          {!online ? <p className="mt-2 text-xs text-warn">Offline: saving will keep this on your device until you reconnect.</p> : null}
        </Panel>
      </div>
      <PartyDialog open={partyOpen} onOpenChange={setPartyOpen} type={partyType} defaultState={biz.stateCode} onSaved={(p) => pickParty(p.id)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between"><dt className="text-muted">{label}</dt><dd><Money value={value} /></dd></div>
  );
}
