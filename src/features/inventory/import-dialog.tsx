"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrowserPermissionDenied } from "@/components/states/permission-denied";
import { getRepo } from "@/data";
import { errorMessage, useRepoMutation } from "@/data/hooks";
import { downloadText, parseCsv, toCsv } from "@/lib/csv";
import { productSchema } from "@/lib/validation/entities";
import type { Product } from "@/domain/types";

const HEADERS = ["name", "sku", "barcode", "hsn", "gst_rate", "unit", "mrp", "sale_price", "wholesale_price", "purchase_price", "opening_stock", "reorder_level", "category", "brand", "is_service"];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;

type Parsed = { rows: Omit<Product, "id">[]; errors: { line: number; message: string }[] };

function parse(text: string): Parsed | { fatal: string } {
  const grid = parseCsv(text);
  if (grid.length < 2) return { fatal: "The file has no data rows. Download the template to see the layout." };
  if (grid.length - 1 > MAX_ROWS) return { fatal: `Import up to ${MAX_ROWS} rows at a time.` };
  const head = grid[0].map((h) => h.trim().toLowerCase());
  if (!head.includes("name")) return { fatal: "The first row must contain a column called name. Download the template to see the layout." };
  const idx = (h: string) => head.indexOf(h);
  const get = (r: string[], h: string) => (idx(h) >= 0 ? (r[idx(h)] ?? "").trim() : "");
  const n = (v: string, d = 0) => (v === "" ? d : Number(v));
  const rows: Omit<Product, "id">[] = [];
  const errors: Parsed["errors"] = [];
  grid.slice(1).forEach((r, i) => {
    const line = i + 2;
    const isService = /^(1|true|yes|y)$/i.test(get(r, "is_service"));
    const candidate = {
      name: get(r, "name"), sku: get(r, "sku"), barcode: get(r, "barcode"), hsn: get(r, "hsn"), isService, gstRate: n(get(r, "gst_rate"), 18), cessPct: 0,
      unit: get(r, "unit") || "PCS", mrp: n(get(r, "mrp")), salePrice: n(get(r, "sale_price")), wholesalePrice: n(get(r, "wholesale_price")),
      purchasePrice: n(get(r, "purchase_price")), openingStock: n(get(r, "opening_stock")), reorderLevel: n(get(r, "reorder_level")),
      category: get(r, "category"), brand: get(r, "brand"), trackBatch: false, trackSerial: false, variantsText: "", active: true,
    };
    const res = productSchema.safeParse(candidate);
    if (!res.success) {
      errors.push({ line, message: res.error.issues[0].message });
      return;
    }
    const { variantsText, ...p } = res.data;
    void variantsText;
    rows.push({ ...p, variants: [] });
  });
  return { rows, errors };
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [parsed, setParsed] = React.useState<Parsed>();
  const [fatal, setFatal] = React.useState<string>();
  const [denied, setDenied] = React.useState(false);
  const bulk = useRepoMutation((rows: Omit<Product, "id">[]) => getRepo().products.bulkUpsert(rows));

  async function onFile(file: File | undefined) {
    setParsed(undefined);
    setFatal(undefined);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setFatal("Choose a .csv file. In Excel use Save As, CSV.");
    if (file.size > MAX_BYTES) return setFatal("The file is larger than 2 MB. Split it into smaller files.");
    try {
      const out = parse(await file.text());
      if ("fatal" in out) setFatal(out.fatal);
      else setParsed(out);
    } catch {
      setDenied(true);
    }
  }

  async function commit() {
    if (!parsed) return;
    try {
      const n = await bulk.mutateAsync(parsed.rows);
      toast.success(`${n} products imported`);
      onOpenChange(false);
      setParsed(undefined);
    } catch (e) {
      toast.error(errorMessage(e).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import products" description="Upload a CSV file. Rows with an existing SKU update that product; other rows create new products." className="max-w-xl">
        <div className="space-y-3 text-sm">
          <button className="link" onClick={() => downloadText("products-template.csv", toCsv(HEADERS, [["Basmati rice 25 kg", "RICE25", "", "1006", 5, "BAG", 1799, 1680, 1560, 1450, 40, 10, "Grocery", "India Gate", "no"]]))}>
            Download the template
          </button>
          {denied ? <BrowserPermissionDenied kind="files" /> : <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void onFile(e.target.files?.[0])} />}
          {fatal ? <p role="alert" className="text-bad">{fatal}</p> : null}
          {parsed ? (
            <div>
              <p>
                <strong>{parsed.rows.length}</strong> rows are ready.{" "}
                {parsed.errors.length ? <span className="text-bad">{parsed.errors.length} rows have problems and will be skipped.</span> : null}
              </p>
              {parsed.errors.length ? (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-line p-2 text-xs">
                  {parsed.errors.slice(0, 50).map((e) => (
                    <li key={e.line}>Row {e.line}: {e.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" disabled={!parsed?.rows.length || bulk.isPending} onClick={() => void commit()}>
              {bulk.isPending ? "Importing" : `Import ${parsed?.rows.length ?? 0} products`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function exportProducts(products: Product[]) {
  downloadText(
    "products.csv",
    toCsv(HEADERS, products.map((p) => [p.name, p.sku, p.barcode, p.hsn, p.gstRate, p.unit, p.mrp, p.salePrice, p.wholesalePrice, p.purchasePrice, p.openingStock, p.reorderLevel, p.category, p.brand, p.isService ? "yes" : "no"])),
  );
}
