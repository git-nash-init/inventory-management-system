"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/ui/surface";
import { useProducts } from "@/data/hooks";
import { code128Bars } from "@/lib/barcode";
import { formatINR } from "@/lib/format/money";
import type { Product } from "@/domain/types";

function Label({ p }: { p: Product }) {
  const code = p.barcode || p.sku;
  let bars: ReturnType<typeof code128Bars> | null = null;
  try {
    bars = code ? code128Bars(code) : null;
  } catch {
    bars = null;
  }
  return (
    <div className="break-inside-avoid border border-line bg-white p-2 text-black" style={{ width: "50mm", height: "30mm" }}>
      <div className="truncate text-[9px] font-semibold">{p.name}</div>
      {bars ? (
        <svg viewBox={`0 0 ${bars.width} 40`} preserveAspectRatio="none" className="mt-0.5 h-[12mm] w-full" role="img" aria-label={`Barcode ${code}`}>
          {bars.rects.map((r, i) => <rect key={i} x={r.x} y={0} width={r.w} height={40} fill="#000" />)}
        </svg>
      ) : (
        <div className="mt-1 text-[8px]">No barcode or SKU</div>
      )}
      <div className="num flex justify-between text-[8px]"><span>{code}</span><span className="font-semibold">{formatINR(p.mrp || p.salePrice)}</span></div>
    </div>
  );
}

export function LabelsPage() {
  const products = useProducts();
  const [picked, setPicked] = React.useState<Record<string, number>>({});
  const items = (products.data ?? []).filter((p) => !p.isService && (p.barcode || p.sku));
  const sheet = items.flatMap((p) => Array.from({ length: picked[p.id] ?? 0 }, () => p));

  return (
    <>
      <div className="no-print">
        <PageHeader title="Barcode labels" description="Choose how many labels of each product to print, then print on 50 by 30 mm label paper." actions={<Button variant="primary" disabled={!sheet.length} onClick={() => window.print()}>Print {sheet.length} labels</Button>} />
        <Panel className="mb-5">
          <ul className="divide-y divide-line text-sm">
            {items.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate">{p.name} <span className="num text-xs text-muted">{p.barcode || p.sku}</span></span>
                <Input type="number" min={0} max={200} aria-label={`Labels for ${p.name}`} value={picked[p.id] ?? 0} onChange={(e) => setPicked((s) => ({ ...s, [p.id]: Math.max(0, Math.min(200, Number(e.target.value) || 0)) }))} className="num w-20 text-right" />
              </li>
            ))}
            {items.length === 0 ? <li className="p-6 text-center text-muted">Products need a barcode or SKU to print labels.</li> : null}
          </ul>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-1">{sheet.map((p, i) => <Label key={p.id + i} p={p} />)}</div>
    </>
  );
}
