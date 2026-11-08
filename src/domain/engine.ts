import { calcInvoice } from "@/lib/gst/calc";
import { formatDocNumber, fyStartYear, toISODate } from "@/lib/format/date";
import { round2, toPaise, fromPaise } from "@/lib/format/money";
import { RepoError } from "@/data/repo";
import { SYS, EXPENSE_CATEGORIES } from "./accounts";
import type {
  Account,
  AdjustInput,
  AuditEntry,
  Business,
  Doc,
  DocInput,
  DocItem,
  DocType,
  Expense,
  ExpenseInput,
  JournalEntry,
  JournalLine,
  Member,
  Party,
  Payment,
  PaymentInput,
  Product,
  StockMovement,
  StockMovementType,
  TransferInput,
  VoucherInput,
  VoucherType,
  Warehouse,
} from "./types";

export type State = {
  business: Business;
  products: Product[];
  warehouses: Warehouse[];
  parties: Party[];
  accounts: Account[];
  movements: StockMovement[];
  docs: Doc[];
  payments: Payment[];
  journal: JournalEntry[];
  expenses: Expense[];
  members: Member[];
  audit: AuditEntry[];
  counters: Record<string, number>;
};

export const uid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const today = () => toISODate(new Date());

// ---------- numbering ----------

export const DEFAULT_PREFIXES: Record<string, string> = {
  quotation: "QTN",
  order: "SO",
  challan: "DC",
  invoice: "INV",
  bill_of_supply: "BOS",
  export_invoice: "EXP",
  credit_note: "CN",
  "p:order": "PO",
  "p:grn": "GRN",
  "p:bill": "PB",
  "p:debit_note": "DN",
  receipt: "RCT",
  payment: "PAY",
  journal: "JV",
  contra: "CNT",
  expense: "EXP-V",
  stock_adjustment: "ADJ",
  opening: "OPN",
};

export function docKey(kind: "sales" | "purchase", type: string) {
  return kind === "purchase" ? `p:${type}` : type;
}

/** Allocates the next number in a series, e.g. INV/25-26/0042. Mutates counters. */
export function nextNumber(state: State, series: string, dateISO: string): string {
  const fy = fyStartYear(new Date(dateISO + "T00:00:00"));
  const k = `${series}|${fy}`;
  const seq = (state.business.sequences[k] ?? state.counters[k] ?? 0) + 1;
  state.counters[k] = seq;
  state.business.sequences[k] = seq;
  const prefix = state.business.prefixes[series] ?? DEFAULT_PREFIXES[series] ?? series.toUpperCase();
  return formatDocNumber(prefix, fy, seq);
}

// ---------- audit ----------

export function logAudit(state: State, actor: string, action: string, entity: string, detail: string, entityId?: string) {
  state.audit.unshift({ id: uid(), at: nowISO(), actor, action, entity, entityId, detail });
  if (state.audit.length > 500) state.audit.length = 500;
}

// ---------- journal ----------

function sumP(lines: JournalLine[], k: "debit" | "credit") {
  return lines.reduce((a, l) => a + toPaise(l[k]), 0);
}

export function post(
  state: State,
  e: { date: string; voucherType: VoucherType; narration: string; refType?: string; refId?: string; lines: JournalLine[]; series?: string },
): JournalEntry {
  const lines = e.lines.filter((l) => toPaise(l.debit) !== 0 || toPaise(l.credit) !== 0);
  if (sumP(lines, "debit") !== sumP(lines, "credit")) {
    throw new RepoError(
      `Entry does not balance. Debits ${fromPaise(sumP(lines, "debit"))} and credits ${fromPaise(sumP(lines, "credit"))} must match.`,
      "input",
      "lines",
    );
  }
  for (const l of lines) {
    if (!state.accounts.some((a) => a.id === l.accountId)) throw new RepoError("An account in this entry does not exist.", "ours");
  }
  const entry: JournalEntry = {
    id: uid(),
    date: e.date,
    voucherType: e.voucherType,
    number: nextNumber(state, e.series ?? e.voucherType, e.date),
    narration: e.narration,
    refType: e.refType,
    refId: e.refId,
    lines: lines.map((l) => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) })),
    createdAt: nowISO(),
  };
  state.journal.push(entry);
  return entry;
}

const dr = (accountId: string, amount: number, partyId?: string): JournalLine => ({ accountId, partyId, debit: round2(amount), credit: 0 });
const cr = (accountId: string, amount: number, partyId?: string): JournalLine => ({ accountId, partyId, debit: 0, credit: round2(amount) });

// ---------- stock ----------

const pk = (productId: string, variantId?: string) => `${productId}|${variantId ?? ""}`;

export function stockQty(state: State, productId: string, variantId: string | undefined, warehouseId?: string): number {
  let q = 0;
  for (const m of state.movements) {
    if (m.productId !== productId || (m.variantId ?? "") !== (variantId ?? "")) continue;
    if (warehouseId && m.warehouseId !== warehouseId) continue;
    q += m.qty;
  }
  return Math.round(q * 1000) / 1000;
}

/** Weighted average cost per unit, replaying movements in order. */
export function avgCostMap(state: State): Map<string, number> {
  const acc = new Map<string, { qty: number; value: number }>();
  for (const m of state.movements) {
    if (m.type === "transfer_in" || m.type === "transfer_out") continue; // internal moves do not change cost
    const k = pk(m.productId, m.variantId);
    const cur = acc.get(k) ?? { qty: 0, value: 0 };
    if (m.qty > 0) {
      cur.qty += m.qty;
      cur.value += m.qty * m.rate;
    } else {
      const avg = cur.qty > 0 ? cur.value / cur.qty : m.rate;
      cur.qty += m.qty;
      cur.value += m.qty * avg;
    }
    acc.set(k, cur);
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) if (v.qty > 0) out.set(k, v.value / v.qty);
  return out;
}

export function unitCost(state: State, costs: Map<string, number>, productId: string, variantId?: string): number {
  return costs.get(pk(productId, variantId)) ?? state.products.find((p) => p.id === productId)?.purchasePrice ?? 0;
}

type BatchStock = { batchNo: string; expiry?: string; qty: number };

export function batchStock(state: State, productId: string, variantId: string | undefined, warehouseId: string): BatchStock[] {
  const map = new Map<string, BatchStock>();
  for (const m of state.movements) {
    if (m.productId !== productId || (m.variantId ?? "") !== (variantId ?? "") || m.warehouseId !== warehouseId) continue;
    const b = m.batchNo ?? "";
    const cur = map.get(b) ?? { batchNo: b, expiry: m.expiry, qty: 0 };
    cur.qty += m.qty;
    if (m.expiry) cur.expiry = m.expiry;
    map.set(b, cur);
  }
  return [...map.values()].filter((b) => b.qty > 0.0005);
}

function addMovement(state: State, m: Omit<StockMovement, "id">) {
  state.movements.push({ ...m, id: uid() });
}

// ---------- documents ----------

const STOCK_OUT: DocType[] = ["invoice", "bill_of_supply", "export_invoice"];
const SALES_TAXABLE_NO_TAX: DocType[] = ["bill_of_supply", "export_invoice"];

export function affectsBooks(kind: "sales" | "purchase", type: DocType): boolean {
  if (kind === "sales") return [...STOCK_OUT, "credit_note"].includes(type);
  return type === "bill" || type === "debit_note";
}

export function isInvoiceLike(kind: "sales" | "purchase", type: DocType): boolean {
  return kind === "sales" ? STOCK_OUT.includes(type) : type === "bill";
}

export function computeDocTotals(
  business: Business,
  input: Pick<DocInput, "items" | "kind" | "type" | "tcsPct">,
  supply: "intra" | "inter",
) {
  const noTax =
    business.taxScheme === "composition" && input.kind === "sales"
      ? true
      : input.kind === "sales" && SALES_TAXABLE_NO_TAX.includes(input.type);
  const t = calcInvoice(
    input.items.map((i) => ({
      qty: i.qty,
      rate: i.rate,
      discountPct: i.discountPct,
      gstRate: i.gstRate,
      cessPct: i.cessPct,
      hsn: i.hsn,
    })),
    supply,
    { noTax, tcsPct: input.kind === "sales" ? input.tcsPct : 0, roundOff: true },
  );
  return {
    subtotal: t.subtotal,
    discount: t.discount,
    taxable: t.taxable,
    cgst: t.cgst,
    sgst: t.sgst,
    igst: t.igst,
    cess: t.cess,
    tcs: t.tcs,
    roundOff: t.roundOff,
    grandTotal: t.grandTotal,
  };
}

function validateDocInput(state: State, input: DocInput) {
  if (input.items.length === 0) throw new RepoError("Add at least one item.", "input", "items");
  for (const [i, it] of input.items.entries()) {
    if (!(it.qty > 0)) throw new RepoError(`Row ${i + 1}: quantity must be more than 0.`, "input", "items");
    if (it.rate < 0) throw new RepoError(`Row ${i + 1}: rate cannot be negative.`, "input", "items");
    if (it.discountPct < 0 || it.discountPct > 100) throw new RepoError(`Row ${i + 1}: discount must be between 0 and 100.`, "input", "items");
  }
  if (input.kind === "purchase" && (input.type === "bill" || input.type === "debit_note") && !input.partyId) {
    throw new RepoError("Choose a supplier.", "input", "partyId");
  }
  if (input.kind === "sales" && input.type !== "invoice" && input.type !== "bill_of_supply" && !input.partyId) {
    throw new RepoError("Choose a customer.", "input", "partyId");
  }
  if (!state.warehouses.some((w) => w.id === input.warehouseId)) throw new RepoError("Choose a warehouse.", "input", "warehouseId");
}

export function createDoc(state: State, input: DocInput, actor: string): Doc {
  validateDocInput(state, input);
  const biz = state.business;
  const supply = input.placeOfSupply === biz.stateCode ? "intra" : "inter";
  const totals = computeDocTotals(biz, input, supply);
  const draft = input.status === "draft";

  // Replacing an existing draft.
  if (input.id) {
    const old = state.docs.find((d) => d.id === input.id);
    if (old && old.status !== "draft") throw new RepoError("Only drafts can be edited. Cancel and re-issue instead.", "input");
    state.docs = state.docs.filter((d) => d.id !== input.id);
  }

  const doc: Doc = {
    ...input,
    id: input.id ?? uid(),
    number: draft ? "Draft" : nextNumber(state, docKey(input.kind, input.type), input.date),
    supply,
    totals,
    paid: 0,
    status: draft ? "draft" : "final",
    einvoice: {},
    createdAt: nowISO(),
    createdBy: actor,
  };

  if (!draft && affectsBooks(doc.kind, doc.type)) postDocument(state, doc);
  state.docs.push(doc);
  logAudit(state, actor, draft ? "saved draft" : "created", `${doc.kind}:${doc.type}`, `${doc.number} for ${doc.partyName || "walk-in"} (${totals.grandTotal})`, doc.id);
  return doc;
}

function postDocument(state: State, doc: Doc) {
  const costs = avgCostMap(state);
  const goods = doc.items.filter((i) => !state.products.find((p) => p.id === i.productId)?.isService);
  const t = doc.totals;
  const party = doc.partyId;
  const outTax = [
    cr(SYS.outCgst, t.cgst), cr(SYS.outSgst, t.sgst), cr(SYS.outIgst, t.igst), cr(SYS.outCess, t.cess),
  ];
  const inTax = [dr(SYS.inCgst, t.cgst), dr(SYS.inSgst, t.sgst), dr(SYS.inIgst, t.igst), dr(SYS.inCess, t.cess)];
  const round = t.roundOff;

  if (doc.kind === "sales" && STOCK_OUT.includes(doc.type)) {
    // Stock out first, so cost is known.
    let cogs = 0;
    for (const it of goods) {
      const out = allocateStockOut(state, it, doc.warehouseId);
      const cost = unitCost(state, costs, it.productId, it.variantId);
      for (const slice of out) {
        addMovement(state, {
          date: doc.date, productId: it.productId, variantId: it.variantId, warehouseId: doc.warehouseId,
          batchNo: slice.batchNo || undefined, expiry: slice.expiry, qty: -slice.qty, rate: cost,
          type: "sale", refType: "sales_doc", refId: doc.id, refNumber: doc.number,
        });
        cogs += slice.qty * cost;
      }
    }
    const lines: JournalLine[] = [
      dr(party ? SYS.debtors : SYS.cash, t.grandTotal, party),
      cr(SYS.sales, t.taxable),
      ...outTax,
      cr(SYS.tcs, t.tcs),
      round > 0 ? cr(SYS.roundOff, round) : dr(SYS.roundOff, -round),
    ];
    post(state, { date: doc.date, voucherType: "sales", narration: `Sales ${doc.number}`, refType: "sales_doc", refId: doc.id, lines, series: "journal" });
    if (cogs > 0) {
      post(state, {
        date: doc.date, voucherType: "sales", narration: `Cost of goods sold ${doc.number}`, refType: "sales_doc", refId: doc.id,
        lines: [dr(SYS.cogs, cogs), cr(SYS.stock, cogs)], series: "journal",
      });
    }
    // Walk-in cash sale is settled immediately.
    if (!party) doc.paid = t.grandTotal;
    return;
  }

  if (doc.kind === "sales" && doc.type === "credit_note") {
    let stockValue = 0;
    for (const it of goods) {
      const cost = unitCost(state, costs, it.productId, it.variantId);
      addMovement(state, {
        date: doc.date, productId: it.productId, variantId: it.variantId, warehouseId: doc.warehouseId,
        batchNo: it.batchNo, expiry: it.expiry, qty: it.qty, rate: cost, type: "sales_return",
        refType: "sales_doc", refId: doc.id, refNumber: doc.number,
      });
      stockValue += it.qty * cost;
    }
    const inv = [dr(SYS.outCgst, t.cgst), dr(SYS.outSgst, t.sgst), dr(SYS.outIgst, t.igst), dr(SYS.outCess, t.cess)];
    post(state, {
      date: doc.date, voucherType: "credit_note", narration: `Credit note ${doc.number}`, refType: "sales_doc", refId: doc.id,
      lines: [
        dr(SYS.salesReturn, t.taxable), ...inv, dr(SYS.tcs, t.tcs),
        round > 0 ? dr(SYS.roundOff, round) : cr(SYS.roundOff, -round),
        cr(party ? SYS.debtors : SYS.cash, t.grandTotal, party),
      ],
      series: "journal",
    });
    if (stockValue > 0) {
      post(state, { date: doc.date, voucherType: "credit_note", narration: `Stock returned ${doc.number}`, refType: "sales_doc", refId: doc.id, lines: [dr(SYS.stock, stockValue), cr(SYS.cogs, stockValue)], series: "journal" });
    }
    return;
  }

  if (doc.kind === "purchase" && doc.type === "bill") {
    let stockValue = 0;
    let serviceValue = 0;
    for (const it of doc.items) {
      const prod = state.products.find((p) => p.id === it.productId);
      const net = round2(it.qty * it.rate * (1 - it.discountPct / 100));
      if (prod?.isService) {
        serviceValue += net;
        continue;
      }
      stockValue += net;
      addMovement(state, {
        date: doc.date, productId: it.productId, variantId: it.variantId, warehouseId: doc.warehouseId,
        batchNo: it.batchNo, expiry: it.expiry, qty: it.qty, rate: it.qty ? net / it.qty : it.rate,
        type: "purchase", refType: "purchase_doc", refId: doc.id, refNumber: doc.number,
      });
    }
    // Any gap between line sums and taxable (rounding) is pushed into stock so entries balance.
    const diff = round2(t.taxable - stockValue - serviceValue);
    stockValue = round2(stockValue + diff);
    post(state, {
      date: doc.date, voucherType: "purchase", narration: `Purchase ${doc.number}`, refType: "purchase_doc", refId: doc.id,
      lines: [
        dr(SYS.stock, stockValue), dr(SYS.directExp, serviceValue), ...inTax,
        round > 0 ? dr(SYS.roundOff, round) : cr(SYS.roundOff, -round),
        cr(SYS.creditors, t.grandTotal, party),
      ],
      series: "journal",
    });
    return;
  }

  if (doc.kind === "purchase" && doc.type === "debit_note") {
    let stockValue = 0;
    for (const it of goods) {
      const out = allocateStockOut(state, it, doc.warehouseId);
      for (const slice of out) {
        addMovement(state, {
          date: doc.date, productId: it.productId, variantId: it.variantId, warehouseId: doc.warehouseId,
          batchNo: slice.batchNo || undefined, expiry: slice.expiry, qty: -slice.qty, rate: it.rate, type: "purchase_return",
          refType: "purchase_doc", refId: doc.id, refNumber: doc.number,
        });
      }
      stockValue += round2(it.qty * it.rate * (1 - it.discountPct / 100));
    }
    const diff = round2(t.taxable - stockValue);
    stockValue = round2(stockValue + diff);
    post(state, {
      date: doc.date, voucherType: "debit_note", narration: `Debit note ${doc.number}`, refType: "purchase_doc", refId: doc.id,
      lines: [
        dr(SYS.creditors, t.grandTotal, party),
        cr(SYS.stock, stockValue),
        cr(SYS.inCgst, t.cgst), cr(SYS.inSgst, t.sgst), cr(SYS.inIgst, t.igst), cr(SYS.inCess, t.cess),
        round > 0 ? cr(SYS.roundOff, round) : dr(SYS.roundOff, -round),
      ],
      series: "journal",
    });
  }
}

/** Picks which batches to take stock from (earliest expiry first) and checks availability. */
function allocateStockOut(state: State, it: DocItem, warehouseId: string): { batchNo: string; expiry?: string; qty: number }[] {
  const prod = state.products.find((p) => p.id === it.productId);
  const wh = it.warehouseId ?? warehouseId;
  const avail = stockQty(state, it.productId, it.variantId, wh);
  if (it.qty > avail + 0.0005) {
    throw new RepoError(`Only ${avail} ${it.unit} of ${it.name} in stock at this warehouse. Reduce the quantity or adjust stock first.`, "input", "items");
  }
  if (!prod?.trackBatch) return [{ batchNo: "", qty: it.qty }];
  const batches = batchStock(state, it.productId, it.variantId, wh);
  if (it.batchNo) {
    const b = batches.find((x) => x.batchNo === it.batchNo);
    if (!b || b.qty + 0.0005 < it.qty) throw new RepoError(`Batch ${it.batchNo} of ${it.name} does not have ${it.qty} ${it.unit}.`, "input", "items");
    return [{ batchNo: b.batchNo, expiry: b.expiry, qty: it.qty }];
  }
  const sorted = [...batches].sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"));
  let left = it.qty;
  const out: { batchNo: string; expiry?: string; qty: number }[] = [];
  for (const b of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, b.qty);
    out.push({ batchNo: b.batchNo, expiry: b.expiry, qty: take });
    left -= take;
  }
  return out;
}

export function cancelDoc(state: State, id: string, actor: string) {
  const doc = state.docs.find((d) => d.id === id);
  if (!doc) throw new RepoError("Document not found.", "ours");
  if (doc.status === "cancelled") return;
  if (doc.partyId && doc.paid > 0.005) {
    throw new RepoError(`${doc.number} has payments recorded against it. Issue a credit note or debit note instead of cancelling.`, "input");
  }
  if (doc.status === "converted") throw new RepoError("This document was already converted. Cancel the converted document instead.", "input");
  if (doc.status === "final" && affectsBooks(doc.kind, doc.type)) {
    // Reverse stock and journals.
    const mv = state.movements.filter((m) => m.refId === doc.id);
    for (const m of mv) addMovement(state, { ...m, qty: -m.qty, type: m.type, reason: `Cancelled ${doc.number}` });
    for (const j of state.journal.filter((j) => j.refId === doc.id && !j.narration.startsWith("Reversal"))) {
      post(state, {
        date: today(), voucherType: j.voucherType, narration: `Reversal of ${j.narration}`, refType: j.refType, refId: doc.id,
        lines: j.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })), series: "journal",
      });
    }
  }
  doc.status = "cancelled";
  logAudit(state, actor, "cancelled", `${doc.kind}:${doc.type}`, doc.number, doc.id);
}

const CONVERSIONS: Record<string, string[]> = {
  "sales:quotation": ["order", "invoice"],
  "sales:order": ["challan", "invoice"],
  "sales:challan": ["invoice"],
  "purchase:order": ["grn", "bill"],
  "purchase:grn": ["bill"],
};

export function convertTargets(kind: "sales" | "purchase", type: string): string[] {
  return CONVERSIONS[`${kind}:${type}`] ?? [];
}

export function convertDoc(state: State, id: string, toType: string, actor: string): Doc {
  const src = state.docs.find((d) => d.id === id);
  if (!src) throw new RepoError("Document not found.", "ours");
  if (src.status !== "final") throw new RepoError("Only issued documents can be converted.", "input");
  if (!convertTargets(src.kind, src.type).includes(toType)) {
    throw new RepoError(`A ${src.type.replace("_", " ")} cannot be converted to ${toType.replace("_", " ")}.`, "input");
  }
  const copy: DocInput = {
    kind: src.kind,
    type: toType as DocType,
    date: today(),
    dueDate: src.dueDate,
    partyId: src.partyId,
    partyName: src.partyName,
    partyGstin: src.partyGstin,
    placeOfSupply: src.placeOfSupply,
    reverseCharge: src.reverseCharge,
    items: src.items.map((i) => ({ ...i })),
    tcsPct: src.tcsPct,
    notes: src.notes,
    terms: src.terms,
    refDocId: src.id,
    warehouseId: src.warehouseId,
    supplierInvoiceNo: undefined,
  };
  const created = createDoc(state, copy, actor);
  src.status = "converted";
  return created;
}

/** Derived payment status for invoice-like documents. */
export type PayStatus = "draft" | "cancelled" | "converted" | "open" | "unpaid" | "partial" | "paid" | "overdue";

export function payStatus(doc: Doc, onDate: string = today()): PayStatus {
  if (doc.status === "draft") return "draft";
  if (doc.status === "cancelled") return "cancelled";
  if (doc.status === "converted") return "converted";
  if (!isInvoiceLike(doc.kind, doc.type)) return "open";
  const due = round2(doc.totals.grandTotal - doc.paid);
  if (due <= 0.005) return "paid";
  const late = doc.dueDate && doc.dueDate < onDate;
  if (late) return "overdue";
  return doc.paid > 0.005 ? "partial" : "unpaid";
}

export function outstanding(doc: Doc): number {
  return round2(doc.totals.grandTotal - doc.paid);
}

// ---------- payments ----------

export function recordPayment(state: State, input: PaymentInput, actor: string): Payment {
  if (!(input.amount > 0)) throw new RepoError("Amount must be more than 0.", "input", "amount");
  const party = state.parties.find((p) => p.id === input.partyId);
  if (!party) throw new RepoError("Choose a party.", "input", "partyId");
  const bank = state.accounts.find((a) => a.id === input.accountId);
  if (!bank || !["Cash in Hand", "Bank Accounts"].includes(bank.group)) throw new RepoError("Choose a cash or bank account.", "input", "accountId");
  const allocated = input.allocations.reduce((a, x) => a + toPaise(x.amount), 0);
  if (allocated > toPaise(input.amount)) throw new RepoError("Allocated amount is more than the payment amount.", "input", "allocations");
  for (const al of input.allocations) {
    const d = state.docs.find((x) => x.id === al.docId);
    if (!d) throw new RepoError("An invoice in the allocation was not found.", "ours");
    if (al.amount > outstanding(d) + 0.005) {
      throw new RepoError(`${d.number} has only ${outstanding(d)} due. Reduce the amount applied to it.`, "input", "allocations");
    }
  }
  const series = input.direction === "in" ? "receipt" : "payment";
  const number = nextNumber(state, series, input.date);
  for (const al of input.allocations) {
    const d = state.docs.find((x) => x.id === al.docId)!;
    d.paid = round2(d.paid + al.amount);
  }
  const payment: Payment = { ...input, partyName: party.name, id: uid(), number, createdAt: nowISO() };
  state.payments.push(payment);
  const lines: JournalLine[] =
    input.direction === "in"
      ? [dr(input.accountId, input.amount), cr(SYS.debtors, input.amount, input.partyId)]
      : [dr(SYS.creditors, input.amount, input.partyId), cr(input.accountId, input.amount)];
  post(state, {
    date: input.date, voucherType: input.direction === "in" ? "receipt" : "payment",
    narration: `${input.direction === "in" ? "Received from" : "Paid to"} ${party.name} ${input.reference}`.trim(),
    refType: "payment", refId: payment.id, lines, series: "journal",
  });
  logAudit(state, actor, input.direction === "in" ? "payment received" : "payment made", "payment", `${number} ${input.amount} ${party.name}`, payment.id);
  return payment;
}

// ---------- parties and products ----------

export function savePartyOpening(state: State, p: Party) {
  if (!p.openingBalance) return;
  const amt = Math.abs(p.openingBalance);
  const positive = p.openingBalance > 0;
  // Positive: a customer owes us (Dr debtors) or we owe a supplier (Cr creditors). Negative flips the side.
  const lines: JournalLine[] =
    p.type === "customer"
      ? positive
        ? [dr(SYS.debtors, amt, p.id), cr(SYS.capital, amt)]
        : [dr(SYS.capital, amt), cr(SYS.debtors, amt, p.id)]
      : positive
        ? [dr(SYS.capital, amt), cr(SYS.creditors, amt, p.id)]
        : [dr(SYS.creditors, amt, p.id), cr(SYS.capital, amt)];
  post(state, { date: today(), voucherType: "opening", narration: `Opening balance ${p.name}`, refType: "party", refId: p.id, lines, series: "opening" });
}

export function saveProductOpening(state: State, p: Product) {
  if (p.isService || !(p.openingStock > 0)) return;
  const wh = state.warehouses.find((w) => w.isDefault) ?? state.warehouses[0];
  if (!wh) return;
  addMovement(state, { date: today(), productId: p.id, warehouseId: wh.id, qty: p.openingStock, rate: p.purchasePrice, type: "opening", refType: "product", refId: p.id, reason: "Opening stock" });
  const value = round2(p.openingStock * p.purchasePrice);
  if (value > 0) {
    post(state, { date: today(), voucherType: "opening", narration: `Opening stock ${p.name}`, refType: "product", refId: p.id, lines: [dr(SYS.stock, value), cr(SYS.capital, value)], series: "opening" });
  }
}

// ---------- adjustments, transfers, expenses, vouchers ----------

export function adjustStock(state: State, input: AdjustInput, actor: string) {
  if (!input.qty) throw new RepoError("Enter a quantity other than 0.", "input", "qty");
  const prod = state.products.find((p) => p.id === input.productId);
  if (!prod) throw new RepoError("Choose a product.", "input", "productId");
  if (prod.isService) throw new RepoError("Services do not have stock.", "input", "productId");
  const costs = avgCostMap(state);
  const cost = unitCost(state, costs, input.productId, input.variantId);
  if (input.qty < 0 && -input.qty > stockQty(state, input.productId, input.variantId, input.warehouseId) + 0.0005) {
    throw new RepoError("You cannot remove more than the quantity in this warehouse.", "input", "qty");
  }
  addMovement(state, {
    date: input.date, productId: input.productId, variantId: input.variantId, warehouseId: input.warehouseId,
    batchNo: input.batchNo, expiry: input.expiry, qty: input.qty, rate: cost, type: "adjustment", reason: `${input.reason}: ${input.note}`.trim(),
  });
  const value = round2(Math.abs(input.qty) * cost);
  if (value > 0) {
    post(state, {
      date: input.date, voucherType: "stock_adjustment", narration: `Stock adjustment ${prod.name} (${input.reason})`, refType: "adjustment",
      lines: input.qty < 0 ? [dr(SYS.stockLoss, value), cr(SYS.stock, value)] : [dr(SYS.stock, value), cr(SYS.stockGain, value)],
      series: "stock_adjustment",
    });
  }
  logAudit(state, actor, "stock adjusted", "stock", `${prod.name} ${input.qty > 0 ? "+" : ""}${input.qty} (${input.reason})`, prod.id);
}

export function transferStock(state: State, input: TransferInput, actor: string) {
  if (!(input.qty > 0)) throw new RepoError("Quantity must be more than 0.", "input", "qty");
  if (input.fromWarehouseId === input.toWarehouseId) throw new RepoError("Choose two different warehouses.", "input", "toWarehouseId");
  const avail = stockQty(state, input.productId, input.variantId, input.fromWarehouseId);
  if (input.qty > avail + 0.0005) throw new RepoError(`Only ${avail} available in the source warehouse.`, "input", "qty");
  const prod = state.products.find((p) => p.id === input.productId);
  const cost = unitCost(state, avgCostMap(state), input.productId, input.variantId);
  const base = { date: input.date, productId: input.productId, variantId: input.variantId, rate: cost, reason: input.note };
  addMovement(state, { ...base, warehouseId: input.fromWarehouseId, qty: -input.qty, type: "transfer_out" as StockMovementType });
  addMovement(state, { ...base, warehouseId: input.toWarehouseId, qty: input.qty, type: "transfer_in" as StockMovementType });
  logAudit(state, actor, "stock transferred", "stock", `${prod?.name ?? ""} x${input.qty}`, input.productId);
}

export function createExpense(state: State, input: ExpenseInput, actor: string): Expense {
  if (!(input.amount > 0)) throw new RepoError("Amount must be more than 0.", "input", "amount");
  const acc = state.accounts.find((a) => a.id === input.accountId);
  if (!acc) throw new RepoError("Choose an expense category.", "input", "accountId");
  const pay = state.accounts.find((a) => a.id === input.payFromAccountId);
  if (!pay || !["Cash in Hand", "Bank Accounts"].includes(pay.group)) throw new RepoError("Choose cash or a bank account to pay from.", "input", "payFromAccountId");
  const gst = round2(input.gstAmount || 0);
  const expense: Expense = { ...input, id: uid(), number: nextNumber(state, "expense", input.date), createdAt: nowISO() };
  state.expenses.push(expense);
  const lines: JournalLine[] = [dr(input.accountId, input.amount), dr(SYS.inCgst, gst / 2), dr(SYS.inSgst, gst / 2), cr(input.payFromAccountId, input.amount + gst)];
  post(state, { date: input.date, voucherType: "expense", narration: `${input.category} ${input.vendor}`.trim(), refType: "expense", refId: expense.id, lines, series: "journal" });
  logAudit(state, actor, "expense added", "expense", `${expense.number} ${input.category} ${input.amount}`, expense.id);
  return expense;
}

export function createVoucher(state: State, input: VoucherInput, actor: string): JournalEntry {
  if (input.lines.length < 2) throw new RepoError("A voucher needs at least two lines.", "input", "lines");
  const e = post(state, { date: input.date, voucherType: input.voucherType, narration: input.narration, refType: "voucher", lines: input.lines, series: input.voucherType });
  logAudit(state, actor, "voucher posted", "voucher", `${e.number} ${input.narration}`, e.id);
  return e;
}

export function expenseCategoryAccount(label: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.label === label)?.accountId ?? "acc-misc";
}
