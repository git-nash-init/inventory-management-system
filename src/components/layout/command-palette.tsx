"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDocs, useParties, useProducts } from "@/data/hooks";
import { NoResults } from "@/components/states/no-results";
import { useAuth } from "@/lib/auth/context";
import { NAV, PAGE_ACTIONS } from "./nav";
import { cn } from "@/lib/utils";

type Item = { id: string; group: string; label: string; hint?: string; href: string; keywords?: string };

export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex h-9 w-full min-w-0 max-w-sm flex-1 items-center gap-2 rounded border border-line bg-surface px-3 text-sm text-muted hover:bg-surface-2"
      aria-label="Search products, customers, invoices and pages"
    >
      <MagnifyingGlass size={16} />
      <span className="flex-1 truncate text-left">Search</span>
      <kbd className="num hidden whitespace-nowrap rounded border border-line px-1.5 text-xs md:inline">Ctrl K</kbd>
    </button>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { can } = useAuth();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const products = useProducts();
  const parties = useParties();
  const sales = useDocs("sales");
  const purchases = useDocs("purchase");

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const g of NAV) {
      if (!can(g.module, "view")) continue;
      for (const c of g.children ?? [{ label: g.label, href: g.href }]) out.push({ id: `p:${c.href}`, group: "Pages", label: c.label, hint: g.label, href: c.href });
    }
    for (const a of PAGE_ACTIONS) out.push({ id: `a:${a.href}`, group: "Actions", label: a.label, href: a.href, keywords: a.keywords });
    for (const p of products.data ?? []) out.push({ id: `pr:${p.id}`, group: "Products", label: p.name, hint: [p.sku, p.barcode].filter(Boolean).join(" · "), href: `/inventory/products?q=${encodeURIComponent(p.name)}`, keywords: `${p.sku} ${p.barcode} ${p.hsn}` });
    for (const p of parties.data ?? []) out.push({ id: `pa:${p.id}`, group: p.type === "customer" ? "Customers" : "Suppliers", label: p.name, hint: p.gstin, href: p.type === "customer" ? `/sales/customers/${p.id}` : `/purchases/suppliers/${p.id}`, keywords: p.phone });
    for (const d of [...(sales.data ?? []), ...(purchases.data ?? [])]) {
      if (d.number === "Draft") continue;
      out.push({ id: `d:${d.id}`, group: "Documents", label: d.number, hint: d.partyName, href: d.kind === "sales" ? `/sales/invoices/${d.id}` : `/purchases/bills/${d.id}`, keywords: d.supplierInvoiceNo });
    }
    return out;
  }, [products.data, parties.data, sales.data, purchases.data, can]);

  const fuse = React.useMemo(
    () => new Fuse(items, { keys: ["label", "hint", "keywords"], threshold: 0.35, ignoreLocation: true }),
    [items],
  );
  const results = React.useMemo(() => (q.trim() ? fuse.search(q).slice(0, 12).map((r) => r.item) : items.filter((i) => i.group === "Actions")), [q, fuse, items]);

  function go(item: Item) {
    onOpenChange(false);
    setQ("");
    router.push(item.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  const loading = products.isPending || parties.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <DialogContent title="Search" description="Find products, customers, suppliers, documents and pages." className="top-24 max-w-xl translate-y-0">
        <div onKeyDown={onKey}>
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Type a name, SKU, barcode, invoice number or page"
            aria-label="Search"
            className="h-10 w-full rounded border border-line bg-paper px-3 text-sm"
          />
          <div className="mt-3 max-h-80 overflow-y-auto" role="listbox" aria-label="Results">
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-muted">Loading your data</p>
            ) : results.length === 0 ? (
              <NoResults
                query={q}
                noun="results"
                candidates={items.map((i) => i.label)}
                onPickSuggestion={(s) => setQ(s)}
                onCreate={(query) => {
                  onOpenChange(false);
                  router.push(`/inventory/products?new=1&name=${encodeURIComponent(query)}`);
                }}
              />
            ) : (
              results.map((r, i) => (
                <button
                  key={r.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn("flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-sm", i === active ? "bg-surface-2" : "")}
                >
                  <span className="truncate">{r.label}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {r.hint ? `${r.hint} · ` : ""}
                    {r.group}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
