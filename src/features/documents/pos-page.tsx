"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, Minus, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel, Skeleton } from "@/components/ui/surface";
import { ProductCombobox } from "@/components/forms/product-combobox";
import { BarcodeScanner } from "@/components/forms/barcode-scanner";
import { SuccessPanel } from "@/components/states/success-panel";
import { ErrorState } from "@/components/states/error-state";
import { getRepo } from "@/data";
import { errorMessage, useBusiness, useMovements, useParties, useProducts, useRepoMutation, useWarehouses } from "@/data/hooks";
import { computeDocTotals } from "@/domain/engine";
import { qtyOn } from "@/domain/reports";
import type { Doc, DocInput, DocItem, Product } from "@/domain/types";
import { amountInWords, formatQty, round2 } from "@/lib/format/money";
import { toISODate } from "@/lib/format/date";
import { useAuth } from "@/lib/auth/context";
import { AccessDenied } from "@/components/states/permission-denied";
import { ROLE_LABEL, rolesFor } from "@/domain/permissions";
import { docHref } from "./config";
import { whatsappLink } from "./share";

type Line = DocItem & { key: string };
type Mode = "cash" | "upi" | "bank";

export function PosPage() {
  const { can, role } = useAuth();
  const business = useBusiness();
  const products = useProducts();
  const parties = useParties();
  const warehouses = useWarehouses();
  const movements = useMovements();
  const [lines, setLines] = React.useState<Line[]>([]);
  const [partyId, setPartyId] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("cash");
  const [tendered, setTendered] = React.useState("");
  const [scan, setScan] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [done, setDone] = React.useState<Doc>();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const create = useRepoMutation((i: DocInput) => getRepo().docs.create(i));
  const pay = useRepoMutation((i: Parameters<ReturnType<typeof getRepo>["payments"]["record"]>[0]) => getRepo().payments.record(i));

  const wh = warehouses.data?.find((w) => w.id === "wh-shop") ?? warehouses.data?.find((w) => w.isDefault) ?? warehouses.data?.[0];
  const biz = business.data;

  const totals = biz ? computeDocTotals(biz, { items: lines, kind: "sales", type: "invoice", tcsPct: 0 }, "intra") : undefined;
  const total = totals?.grandTotal ?? 0;
  const change = mode === "cash" && tendered ? round2(Number(tendered) - total) : 0;

  function add(p: Product) {
    setError(undefined);
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id && l.variantId === p.variants[0]?.id);
      if (existing) return ls.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      const v = p.variants[0];
      return [...ls, { key: crypto.randomUUID(), productId: p.id, variantId: v?.id, name: v ? `${p.name} (${v.name})` : p.name, hsn: p.hsn, qty: 1, unit: p.unit, rate: v?.salePrice ?? p.salePrice, discountPct: 0, gstRate: p.gstRate, cessPct: p.cessPct }];
    });
  }
  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const charge = React.useCallback(async () => {
    if (!biz || !wh) return;
    if (!lines.length) return setError("Add at least one item first.");
    setError(undefined);
    const party = parties.data?.find((p) => p.id === partyId);
    const account = mode === "cash" ? "acc-cash" : "acc-bank";
    try {
      const doc = await create.mutateAsync({
        kind: "sales", type: "invoice", date: toISODate(new Date()), dueDate: toISODate(new Date()), partyId: party?.id, partyName: party?.name ?? "Walk-in customer",
        partyGstin: party?.gstin ?? "", placeOfSupply: party?.stateCode ?? biz.stateCode, reverseCharge: false, tcsPct: 0, notes: "", terms: biz.terms, warehouseId: wh.id,
        items: lines.map(({ key, ...rest }) => (void key, rest)), settleAccountId: account,
      });
      if (party) {
        await pay.mutateAsync({ direction: "in", date: doc.date, partyId: party.id, amount: doc.totals.grandTotal, mode, reference: "POS", accountId: account, allocations: [{ docId: doc.id, amount: doc.totals.grandTotal }], notes: "Paid at counter" });
      }
      setDone({ ...doc, paid: doc.totals.grandTotal });
      setLines([]);
      setTendered("");
      toast.success(`${doc.number} saved`);
    } catch (e) {
      const m = errorMessage(e);
      setError(m.message);
    }
  }, [biz, wh, lines, parties.data, partyId, mode, create, pay]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        void charge();
      } else if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [charge]);

  if (!can("sales", "create")) return <AccessDenied yourRole={ROLE_LABEL[role]} needed={rolesFor("sales", "create").map((r) => ROLE_LABEL[r])} />;
  if (business.error || products.error || movements.error) return <ErrorState what="The billing screen could not be prepared" blame="network" onRetry={() => { void business.refetch(); void products.refetch(); void movements.refetch(); }} />;
  if (!biz || !products.data || !movements.data || !wh) return <div aria-busy="true"><Skeleton className="mb-3 h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;

  if (done) {
    const party = parties.data?.find((p) => p.id === done.partyId);
    const wa = party?.phone ? whatsappLink(done, biz, party.phone) : undefined;
    return (
      <div className="mx-auto max-w-xl">
        <SuccessPanel title={`Bill ${done.number} saved`} detail={`${amountInWords(done.totals.grandTotal)}`} steps={[
          { label: "Print receipt", href: docHref("sales", done.type, done.id) },
          ...(wa ? [{ label: "Share on WhatsApp", onClick: () => window.open(wa, "_blank", "noopener,noreferrer") }] : []),
          { label: "Next customer", onClick: () => { setDone(undefined); setTimeout(() => searchRef.current?.focus(), 50); } },
        ]} />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Quick bill" description={`Counter billing from ${wh.name}. Scan or type a barcode and press Enter. F2 focuses search, F9 charges.`} actions={<Link href="/sales/invoices" className="link text-sm">All invoices</Link>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel>
          <div className="flex gap-2 border-b border-line p-3">
            <div className="flex-1"><ProductCombobox products={products.data} onPick={add} inputRef={searchRef} autoFocus stock={(p) => qtyOn(movements.data, p.id, p.variants[0]?.id, wh.id)} placeholder="Scan barcode or search product" /></div>
            <Button onClick={() => setScan(true)} aria-label="Scan with camera" size="icon"><Camera size={16} /></Button>
          </div>
          {lines.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-muted">The bill is empty. Scan a barcode or search for a product to start.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => {
                const avail = qtyOn(movements.data, l.productId, l.variantId, wh.id);
                const over = l.qty > avail;
                return (
                  <li key={l.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="text-xs text-muted">{l.gstRate}% GST · {formatQty(avail)} {l.unit} in stock{over ? <span className="text-bad"> · not enough stock</span> : null}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" aria-label={`Decrease ${l.name}`} onClick={() => (l.qty <= 1 ? setLines((ls) => ls.filter((x) => x.key !== l.key)) : patch(l.key, { qty: l.qty - 1 }))}><Minus size={14} /></Button>
                      <Input aria-label={`Quantity of ${l.name}`} type="number" min="0" step="any" value={Number.isNaN(l.qty) ? "" : l.qty} onChange={(e) => patch(l.key, { qty: e.target.valueAsNumber })} className="num w-16 text-center" />
                      <Button size="icon" aria-label={`Increase ${l.name}`} onClick={() => patch(l.key, { qty: l.qty + 1 })}><Plus size={14} /></Button>
                    </div>
                    <Input aria-label={`Rate of ${l.name}`} type="number" min="0" step="any" value={Number.isNaN(l.rate) ? "" : l.rate} onChange={(e) => patch(l.key, { rate: e.target.valueAsNumber })} className="num w-24 text-right" />
                    <div className="w-24 text-right"><Money value={round2(l.qty * l.rate * (1 + l.gstRate / 100))} /></div>
                    <button aria-label={`Remove ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-bad"><Trash size={16} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="h-fit p-4">
          <label className="text-xs text-muted" htmlFor="pos-cust">Customer</label>
          <NativeSelect id="pos-cust" value={partyId} onChange={(e) => setPartyId(e.target.value)} className="mb-3 mt-1">
            <option value="">Walk-in customer</option>
            {parties.data?.filter((p) => p.type === "customer" && p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="num">{lines.reduce((a, l) => a + (l.qty || 0), 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Taxable</dt><dd><Money value={totals?.taxable ?? 0} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted">GST</dt><dd><Money value={(totals?.cgst ?? 0) + (totals?.sgst ?? 0) + (totals?.igst ?? 0)} /></dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-xl font-semibold"><dt>Total</dt><dd><Money value={total} /></dd></div>
          </dl>
          <fieldset className="mt-3">
            <legend className="mb-1 text-xs text-muted">Payment</legend>
            <div className="grid grid-cols-3 gap-2">
              {([["cash", "Cash"], ["upi", "UPI"], ["bank", "Card or bank"]] as const).map(([v, l]) => (
                <Button key={v} variant={mode === v ? "primary" : "secondary"} aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</Button>
              ))}
            </div>
          </fieldset>
          {mode === "cash" ? (
            <div className="mt-3">
              <label className="text-xs text-muted" htmlFor="tender">Cash received</label>
              <Input id="tender" type="number" step="any" value={tendered} onChange={(e) => setTendered(e.target.value)} className="num mt-1 text-right" />
              {tendered ? <p className={`mt-1 text-sm ${change < 0 ? "text-bad" : ""}`}>{change < 0 ? "Short by " : "Change to return "}<Money value={Math.abs(change)} /></p> : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="mt-3 rounded border border-bad/40 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p> : null}
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => void charge()} disabled={create.isPending || pay.isPending || !lines.length}>
            {create.isPending ? "Saving" : "Charge (F9)"}
          </Button>
        </Panel>
      </div>
      <BarcodeScanner open={scan} onOpenChange={setScan} onCode={(code) => { const p = products.data.find((x) => x.barcode === code || x.sku === code); if (p) add(p); else toast.error(`No product has the barcode or SKU ${code}`); }} />
    </>
  );
}
