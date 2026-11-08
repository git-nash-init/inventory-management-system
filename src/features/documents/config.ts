import type { DocKind, DocType } from "@/domain/types";

export type DocRoute = {
  /** URL segment under /sales or /purchases. */
  segment: string;
  kind: DocKind;
  types: DocType[];
  /** Type used for "New". */
  defaultType: DocType;
  title: string;
  singular: string;
  description: string;
  partyLabel: string;
  emptyReason: string;
};

export const DOC_ROUTES: DocRoute[] = [
  { segment: "invoices", kind: "sales", types: ["invoice", "bill_of_supply", "export_invoice"], defaultType: "invoice", title: "Sales invoices", singular: "invoice", description: "Tax invoices, bills of supply and export invoices.", partyLabel: "Customer", emptyReason: "Create your first GST invoice. Stock goes down and the books update when you issue it." },
  { segment: "quotations", kind: "sales", types: ["quotation"], defaultType: "quotation", title: "Quotations", singular: "quotation", description: "Estimates you can convert to an order or invoice in one click.", partyLabel: "Customer", emptyReason: "Send a customer an estimate before they commit. Convert it to an invoice when they say yes." },
  { segment: "orders", kind: "sales", types: ["order"], defaultType: "order", title: "Sales orders", singular: "order", description: "Confirmed customer orders waiting for delivery.", partyLabel: "Customer", emptyReason: "Record what customers have ordered. Convert to a challan or invoice when you deliver." },
  { segment: "challans", kind: "sales", types: ["challan"], defaultType: "challan", title: "Delivery challans", singular: "challan", description: "Goods sent out before the invoice is raised.", partyLabel: "Customer", emptyReason: "Use a challan when goods leave before billing. Convert it to an invoice later." },
  { segment: "returns", kind: "sales", types: ["credit_note"], defaultType: "credit_note", title: "Sales returns", singular: "credit note", description: "Credit notes for goods customers sent back.", partyLabel: "Customer", emptyReason: "When a customer returns goods, issue a credit note. Stock comes back and the receivable drops." },
  { segment: "bills", kind: "purchase", types: ["bill"], defaultType: "bill", title: "Purchase bills", singular: "bill", description: "Supplier bills. Stock goes up and input tax credit is recorded.", partyLabel: "Supplier", emptyReason: "Record what you bought. Stock goes up and the amount you owe the supplier is tracked." },
  { segment: "orders", kind: "purchase", types: ["order"], defaultType: "order", title: "Purchase orders", singular: "purchase order", description: "Orders placed with suppliers.", partyLabel: "Supplier", emptyReason: "Raise a purchase order before you buy. Convert it to a goods receipt or bill when stock arrives." },
  { segment: "grn", kind: "purchase", types: ["grn"], defaultType: "grn", title: "Goods received", singular: "goods receipt", description: "Goods that arrived and are waiting for the supplier bill.", partyLabel: "Supplier", emptyReason: "Note goods the moment they arrive. Convert to a bill when the supplier invoice comes." },
  { segment: "returns", kind: "purchase", types: ["debit_note"], defaultType: "debit_note", title: "Purchase returns", singular: "debit note", description: "Debit notes for goods you sent back to suppliers.", partyLabel: "Supplier", emptyReason: "When you return goods to a supplier, issue a debit note. Stock goes down and the payable drops." },
];

export const routeFor = (kind: DocKind, segment: string) => DOC_ROUTES.find((r) => r.kind === kind && r.segment === segment);
export const routeForDoc = (kind: DocKind, type: DocType) => DOC_ROUTES.find((r) => r.kind === kind && r.types.includes(type));
export const basePath = (kind: DocKind) => (kind === "sales" ? "/sales" : "/purchases");
export const docHref = (kind: DocKind, type: DocType, id: string) => `${basePath(kind)}/${routeForDoc(kind, type)?.segment ?? "invoices"}/${id}`;

export const TYPE_LABEL: Record<string, string> = {
  quotation: "Quotation",
  order: "Order",
  challan: "Delivery challan",
  invoice: "Tax invoice",
  bill_of_supply: "Bill of supply",
  export_invoice: "Export invoice",
  credit_note: "Credit note",
  grn: "Goods received note",
  bill: "Purchase bill",
  debit_note: "Debit note",
};
