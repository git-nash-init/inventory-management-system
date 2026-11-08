import { fromPaise, toPaise } from "@/lib/format/money";

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export type LineInput = {
  qty: number;
  rate: number; // per unit, rupees
  discountPct?: number;
  discountAmt?: number; // flat, applied after pct
  gstRate: number; // total GST %, e.g. 18
  cessPct?: number;
  priceIncludesTax?: boolean;
  hsn?: string;
};

export type LineResult = {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
  hsn?: string;
  gstRate: number;
};

export type SupplyType = "intra" | "inter";

/** Intra-state when seller state equals place of supply, otherwise inter-state. */
export function supplyType(sellerStateCode: string, placeOfSupplyCode: string): SupplyType {
  return sellerStateCode === placeOfSupplyCode ? "intra" : "inter";
}

export function calcLine(
  line: LineInput,
  supply: SupplyType,
  opts: { noTax?: boolean } = {},
): LineResult {
  const rate = opts.noTax ? 0 : line.gstRate;
  const cessPct = opts.noTax ? 0 : (line.cessPct ?? 0);
  let grossP = toPaise(line.qty * line.rate);

  const pctDiscP = Math.round((grossP * (line.discountPct ?? 0)) / 100);
  let discountP = pctDiscP + toPaise(line.discountAmt ?? 0);
  if (discountP > grossP) discountP = grossP;
  let taxableP = grossP - discountP;

  // Tax-inclusive price: back the tax out of the net-of-discount amount.
  if (line.priceIncludesTax && rate + cessPct > 0) {
    taxableP = Math.round((taxableP * 100) / (100 + rate + cessPct));
    grossP = taxableP + discountP;
  }

  const totalGstP = Math.round((taxableP * rate) / 100);
  let cgstP = 0;
  let sgstP = 0;
  let igstP = 0;
  if (supply === "intra") {
    cgstP = Math.round(totalGstP / 2);
    sgstP = totalGstP - cgstP;
  } else {
    igstP = totalGstP;
  }
  const cessP = Math.round((taxableP * cessPct) / 100);

  return {
    gross: fromPaise(grossP),
    discount: fromPaise(discountP),
    taxable: fromPaise(taxableP),
    cgst: fromPaise(cgstP),
    sgst: fromPaise(sgstP),
    igst: fromPaise(igstP),
    cess: fromPaise(cessP),
    total: fromPaise(taxableP + totalGstP + cessP),
    hsn: line.hsn,
    gstRate: rate,
  };
}

export type InvoiceTotals = {
  lines: LineResult[];
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tcs: number;
  roundOff: number;
  grandTotal: number;
};

export function calcInvoice(
  lines: LineInput[],
  supply: SupplyType,
  opts: { noTax?: boolean; tcsPct?: number; roundOff?: boolean } = {},
): InvoiceTotals {
  const results = lines.map((l) => calcLine(l, supply, opts));
  const sumP = (k: "gross" | "discount" | "taxable" | "cgst" | "sgst" | "igst" | "cess") =>
    results.reduce((a, r) => a + toPaise(r[k]), 0);
  const taxableP = sumP("taxable");
  const cgstP = sumP("cgst");
  const sgstP = sumP("sgst");
  const igstP = sumP("igst");
  const cessP = sumP("cess");
  const tcsP = Math.round(((taxableP + cgstP + sgstP + igstP + cessP) * (opts.tcsPct ?? 0)) / 100);
  const beforeRoundP = taxableP + cgstP + sgstP + igstP + cessP + tcsP;
  const roundedP = (opts.roundOff ?? true) ? Math.round(beforeRoundP / 100) * 100 : beforeRoundP;
  return {
    lines: results,
    subtotal: fromPaise(sumP("gross")),
    discount: fromPaise(sumP("discount")),
    taxable: fromPaise(taxableP),
    cgst: fromPaise(cgstP),
    sgst: fromPaise(sgstP),
    igst: fromPaise(igstP),
    cess: fromPaise(cessP),
    tcs: fromPaise(tcsP),
    roundOff: fromPaise(roundedP - beforeRoundP),
    grandTotal: fromPaise(roundedP),
  };
}

export type HsnRow = {
  hsn: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
};

/** HSN-wise summary table required on tax invoices and in GSTR-1. */
export function hsnSummary(lines: LineResult[]): HsnRow[] {
  const map = new Map<string, Record<keyof HsnRow, number | string>>();
  for (const l of lines) {
    const key = `${l.hsn ?? ""}|${l.gstRate}`;
    const row =
      map.get(key) ??
      ({ hsn: l.hsn ?? "", gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 } as Record<keyof HsnRow, number | string>);
    for (const k of ["taxable", "cgst", "sgst", "igst", "cess", "total"] as const) {
      row[k] = (row[k] as number) + toPaise(l[k]);
    }
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({
    hsn: r.hsn as string,
    gstRate: r.gstRate as number,
    taxable: fromPaise(r.taxable as number),
    cgst: fromPaise(r.cgst as number),
    sgst: fromPaise(r.sgst as number),
    igst: fromPaise(r.igst as number),
    cess: fromPaise(r.cess as number),
    total: fromPaise(r.total as number),
  }));
}
