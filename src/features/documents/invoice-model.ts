import { calcLine, hsnSummary, type HsnRow, type LineResult } from "@/lib/gst/calc";
import { amountInWords } from "@/lib/format/money";
import { stateName } from "@/lib/gst/states";
import type { Business, Doc, Party } from "@/domain/types";
import { TYPE_LABEL } from "./config";
import { upiLink } from "./share";

export type InvoiceLine = {
  no: number;
  name: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  taxable: number;
  gstRate: number;
  tax: number;
  total: number;
};

export type InvoiceModel = {
  title: string;
  isTax: boolean;
  doc: Doc;
  biz: Business;
  party?: Party;
  lines: InvoiceLine[];
  hsn: HsnRow[];
  intra: boolean;
  words: string;
  due: number;
  upi?: string;
  placeName: string;
};

export function buildInvoiceModel(doc: Doc, biz: Business, party?: Party): InvoiceModel {
  const noTax = doc.totals.cgst + doc.totals.sgst + doc.totals.igst + doc.totals.cess === 0 && (doc.type === "bill_of_supply" || doc.type === "export_invoice" || biz.taxScheme === "composition");
  const results: LineResult[] = doc.items.map((i) => calcLine({ qty: i.qty, rate: i.rate, discountPct: i.discountPct, gstRate: i.gstRate, cessPct: i.cessPct, hsn: i.hsn }, doc.supply, { noTax }));
  const lines: InvoiceLine[] = doc.items.map((i, idx) => {
    const r = results[idx];
    return { no: idx + 1, name: i.name, hsn: i.hsn, qty: i.qty, unit: i.unit, rate: i.rate, discount: r.discount, taxable: r.taxable, gstRate: r.gstRate, tax: r.cgst + r.sgst + r.igst + r.cess, total: r.total };
  });
  const due = Math.max(0, Math.round((doc.totals.grandTotal - doc.paid) * 100) / 100);
  const title = noTax && doc.type === "invoice" ? "Bill of supply" : TYPE_LABEL[doc.type];
  return {
    title,
    isTax: !noTax,
    doc, biz, party, lines,
    hsn: hsnSummary(results),
    intra: doc.supply === "intra",
    words: amountInWords(doc.totals.grandTotal),
    due,
    upi: due > 0 && ["invoice", "bill_of_supply", "export_invoice"].includes(doc.type) ? upiLink(biz, due, doc.number) : undefined,
    placeName: `${doc.placeOfSupply} ${stateName(doc.placeOfSupply)}`.trim(),
  };
}
