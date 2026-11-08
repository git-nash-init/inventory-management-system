"use client";

import * as React from "react";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import type { Product } from "@/domain/types";

/** Type to search by name, SKU, barcode or HSN. Enter on an exact barcode or SKU picks it directly. */
export function ProductCombobox({
  products,
  onPick,
  placeholder = "Search product, SKU or barcode",
  inputRef,
  autoFocus,
  stock,
}: {
  products: Product[];
  onPick: (p: Product) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  stock?: (p: Product) => number;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const fuse = React.useMemo(() => new Fuse(products.filter((p) => p.active), { keys: ["name", "sku", "barcode", "hsn", "brand"], threshold: 0.3, ignoreLocation: true }), [products]);
  const results = React.useMemo(() => (q.trim() ? fuse.search(q.trim()).slice(0, 8).map((r) => r.item) : []), [q, fuse]);

  function pick(p: Product) {
    onPick(p);
    setQ("");
    setOpen(false);
    setActive(0);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const term = q.trim().toLowerCase();
      const exact = products.find((p) => p.barcode.toLowerCase() === term || (p.sku && p.sku.toLowerCase() === term));
      const choice = exact ?? results[active];
      if (choice) pick(choice);
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        className="h-9 w-full rounded border border-line bg-surface px-3 text-sm"
      />
      {open && q.trim() ? (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded border border-line bg-surface">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No product matches &quot;{q}&quot;. Check the spelling or add it under Inventory, Products.</li>
          ) : (
            results.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm", i === active && "bg-surface-2")}
                >
                  <span className="truncate">
                    {p.name} <span className="num text-xs text-muted">{p.sku}</span>
                  </span>
                  {stock && !p.isService ? <span className="num shrink-0 text-xs text-muted">{stock(p)} {p.unit}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
