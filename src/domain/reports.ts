import { round2, toPaise, fromPaise } from "@/lib/format/money";
import { daysBetween } from "@/lib/format/date";
import { hsnSummary, type LineResult } from "@/lib/gst/calc";
import { calcLine } from "@/lib/gst/calc";
import { isDebitNature, SYS } from "./accounts";
import { isInvoiceLike, outstanding, payStatus } from "./engine";
import type { Account, Doc, JournalEntry, Party, Product, StockMovement } from "./types";

// ---------- account balances ----------

export type AccountTotals = { debit: number; credit: number };

export function accountTotals(journal: JournalEntry[], from?: string, to?: string): Map<string, AccountTotals> {
  const m = new Map<string, { d: number; c: number }>();
  for (const e of journal) {
    if (from && e.date < from) continue;
    if (to && e.date > to) continue;
    for (const l of e.lines) {
      const cur = m.get(l.accountId) ?? { d: 0, c: 0 };
      cur.d += toPaise(l.debit);
      cur.c += toPaise(l.credit);
      m.set(l.accountId, cur);
    }
  }
  return new Map([...m].map(([k, v]) => [k, { debit: fromPaise(v.d), credit: fromPaise(v.c) }]));
}

/** Natural-side balance: positive means balance sits on the account's normal side. */
export function naturalBalance(a: Account, t?: AccountTotals): number {
  if (!t) return 0;
  return round2(isDebitNature(a.nature) ? t.debit - t.credit : t.credit - t.debit);
}

export type TbRow = { account: Account; debit: number; credit: number };

export function trialBalance(accounts: Account[], journal: JournalEntry[], asOf?: string) {
  const totals = accountTotals(journal, undefined, asOf);
  const rows: TbRow[] = [];
  for (const a of accounts) {
    const t = totals.get(a.id);
    if (!t) continue;
    const net = round2(t.debit - t.credit);
    if (Math.abs(net) < 0.005) continue;
    rows.push({ account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }
  const debit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const credit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

export type PlLine = { label: string; amount: number };

export function profitAndLoss(accounts: Account[], journal: JournalEntry[], from: string, to: string) {
  const totals = accountTotals(journal, from, to);
  const bal = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? naturalBalance(a, totals.get(id)) : 0;
  };
  const byGroup = (group: Account["group"], exclude: string[] = []) =>
    accounts
      .filter((a) => a.group === group && !exclude.includes(a.id))
      .map((a) => ({ label: a.name, amount: naturalBalance(a, totals.get(a.id)) }))
      .filter((l) => Math.abs(l.amount) > 0.004);

  const sales = bal(SYS.sales);
  const salesReturns = bal(SYS.salesReturn);
  const netSales = round2(sales - salesReturns);
  const cogs = bal(SYS.cogs);
  const directExpenses = byGroup("Direct Expenses", [SYS.cogs]);
  const directTotal = round2(directExpenses.reduce((s, l) => s + l.amount, 0));
  const grossProfit = round2(netSales - cogs - directTotal);
  const indirectIncome = byGroup("Indirect Income");
  const indirectExpenses = byGroup("Indirect Expenses");
  const incomeTotal = round2(indirectIncome.reduce((s, l) => s + l.amount, 0));
  const expenseTotal = round2(indirectExpenses.reduce((s, l) => s + l.amount, 0));
  const netProfit = round2(grossProfit + incomeTotal - expenseTotal);
  return { sales, salesReturns, netSales, cogs, directExpenses, grossProfit, indirectIncome, indirectExpenses, netProfit };
}

export function balanceSheet(accounts: Account[], journal: JournalEntry[], asOf: string, fyFrom: string) {
  const totals = accountTotals(journal, undefined, asOf);
  const pick = (nature: Account["nature"], parties?: boolean) =>
    accounts
      .filter((a) => a.nature === nature && (parties === undefined || true))
      .map((a) => ({ label: a.name, amount: naturalBalance(a, totals.get(a.id)) }))
      .filter((l) => Math.abs(l.amount) > 0.004);
  const assets = pick("asset");
  const liabilities = pick("liability");
  const capital = pick("capital");
  // Current profit = all income minus all expense up to asOf (carried into capital).
  const income = accounts.filter((a) => a.nature === "income").reduce((s, a) => s + naturalBalance(a, totals.get(a.id)), 0);
  const expense = accounts.filter((a) => a.nature === "expense").reduce((s, a) => s + naturalBalance(a, totals.get(a.id)), 0);
  const profit = round2(income - expense);
  void fyFrom;
  const assetTotal = round2(assets.reduce((s, l) => s + l.amount, 0));
  const liabTotal = round2(liabilities.reduce((s, l) => s + l.amount, 0));
  const capTotal = round2(capital.reduce((s, l) => s + l.amount, 0) + profit);
  return { assets, liabilities, capital, profit, assetTotal, liabTotal, capTotal, balanced: Math.abs(assetTotal - (liabTotal + capTotal)) < 0.01 };
}

// ---------- books ----------

export type BookRow = { date: string; number: string; narration: string; debit: number; credit: number; balance: number; against?: string };

/** Cash book / bank book / any single account ledger with running balance. */
export function accountBook(account: Account, accounts: Account[], journal: JournalEntry[], from: string, to: string) {
  const debitNormal = isDebitNature(account.nature);
  let opening = 0;
  const inRange: { e: JournalEntry; d: number; c: number }[] = [];
  for (const e of journal) {
    let d = 0;
    let c = 0;
    for (const l of e.lines) if (l.accountId === account.id) { d += l.debit; c += l.credit; }
    if (!d && !c) continue;
    if (e.date < from) opening += debitNormal ? d - c : c - d;
    else if (e.date <= to) inRange.push({ e, d, c });
  }
  inRange.sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.createdAt.localeCompare(b.e.createdAt));
  let run = round2(opening);
  const rows: BookRow[] = inRange.map(({ e, d, c }) => {
    run = round2(run + (debitNormal ? d - c : c - d));
    const other = e.lines.find((l) => l.accountId !== account.id);
    return { date: e.date, number: e.number, narration: e.narration, debit: round2(d), credit: round2(c), balance: run, against: other ? accounts.find((a) => a.id === other.accountId)?.name : undefined };
  });
  return { opening: round2(opening), rows, closing: run };
}

export function dayBook(journal: JournalEntry[], date: string) {
  return journal.filter((e) => e.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- parties ----------

/** Positive = the party owes us (customer) or we owe them (supplier). */
export function partyBalances(parties: Party[], journal: JournalEntry[]): Map<string, number> {
  const raw = new Map<string, number>();
  for (const e of journal) {
    for (const l of e.lines) {
      if (!l.partyId) continue;
      raw.set(l.partyId, (raw.get(l.partyId) ?? 0) + toPaise(l.debit) - toPaise(l.credit));
    }
  }
  const out = new Map<string, number>();
  for (const p of parties) {
    const net = fromPaise(raw.get(p.id) ?? 0);
    out.set(p.id, round2(p.type === "customer" ? net : -net));
  }
  return out;
}

export type LedgerRow = { date: string; number: string; narration: string; debit: number; credit: number; balance: number };

export function partyLedger(party: Party, journal: JournalEntry[], from?: string, to?: string) {
  const sign = party.type === "customer" ? 1 : -1;
  const rows: { e: JournalEntry; d: number; c: number }[] = [];
  let opening = 0;
  for (const e of journal) {
    let d = 0;
    let c = 0;
    for (const l of e.lines) if (l.partyId === party.id) { d += l.debit; c += l.credit; }
    if (!d && !c) continue;
    if (from && e.date < from) opening += sign * (d - c);
    else if (!to || e.date <= to) rows.push({ e, d, c });
  }
  rows.sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.createdAt.localeCompare(b.e.createdAt));
  let run = round2(opening);
  const out: LedgerRow[] = rows.map(({ e, d, c }) => {
    run = round2(run + sign * (d - c));
    return { date: e.date, number: e.number, narration: e.narration, debit: round2(d), credit: round2(c), balance: run };
  });
  return { opening: round2(opening), rows: out, closing: run };
}

// ---------- aging ----------

export type AgingRow = {
  partyId: string;
  partyName: string;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  over90: number;
  total: number;
};

/** Buckets by days past due: 0-30, 31-60, 61-90, 90+. Not-yet-due counts as current. */
export function aging(docs: Doc[], kind: "sales" | "purchase", asOf: string): AgingRow[] {
  const map = new Map<string, AgingRow>();
  for (const d of docs) {
    if (d.kind !== kind || d.status !== "final" || !isInvoiceLike(kind, d.type) || !d.partyId) continue;
    const due = outstanding(d);
    if (due <= 0.005) continue;
    const basis = d.dueDate ?? d.date;
    const late = daysBetween(new Date(basis + "T00:00:00"), new Date(asOf + "T00:00:00"));
    const row = map.get(d.partyId) ?? { partyId: d.partyId, partyName: d.partyName, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
    if (late <= 0) row.current += due;
    else if (late <= 30) row.d30 += due;
    else if (late <= 60) row.d60 += due;
    else if (late <= 90) row.d90 += due;
    else row.over90 += due;
    row.total += due;
    map.set(d.partyId, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, current: round2(r.current), d30: round2(r.d30), d60: round2(r.d60), d90: round2(r.d90), over90: round2(r.over90), total: round2(r.total) }))
    .sort((a, b) => b.total - a.total);
}

// ---------- GST returns ----------

const inRange = (d: Doc, from: string, to: string) => d.status === "final" && d.date >= from && d.date <= to;

export function gstr1(docs: Doc[], businessState: string, from: string, to: string) {
  const sales = docs.filter((d) => d.kind === "sales" && inRange(d, from, to));
  const invoices = sales.filter((d) => ["invoice", "export_invoice"].includes(d.type));
  const b2b = invoices.filter((d) => d.partyGstin);
  const b2cl = invoices.filter((d) => !d.partyGstin && d.supply === "inter" && d.totals.grandTotal > 250000);
  const b2csDocs = invoices.filter((d) => !d.partyGstin && !b2cl.includes(d));
  const b2cs = new Map<string, { place: string; rate: number; taxable: number; tax: number }>();
  for (const d of b2csDocs) {
    for (const it of d.items) {
      const l = calcLine({ qty: it.qty, rate: it.rate, discountPct: it.discountPct, gstRate: it.gstRate, cessPct: it.cessPct }, d.supply);
      const k = `${d.placeOfSupply}|${it.gstRate}`;
      const cur = b2cs.get(k) ?? { place: d.placeOfSupply, rate: it.gstRate, taxable: 0, tax: 0 };
      cur.taxable += l.taxable;
      cur.tax += l.cgst + l.sgst + l.igst;
      b2cs.set(k, cur);
    }
  }
  const cdnr = sales.filter((d) => d.type === "credit_note");
  const lines: LineResult[] = [];
  for (const d of [...invoices, ...sales.filter((x) => x.type === "bill_of_supply")]) {
    for (const it of d.items) {
      lines.push(calcLine({ qty: it.qty, rate: it.rate, discountPct: it.discountPct, gstRate: it.gstRate, cessPct: it.cessPct, hsn: it.hsn }, d.supply, { noTax: d.type !== "invoice" }));
    }
  }
  void businessState;
  return {
    b2b,
    b2cl,
    b2cs: [...b2cs.values()].map((r) => ({ ...r, taxable: round2(r.taxable), tax: round2(r.tax) })),
    cdnr,
    hsn: hsnSummary(lines),
    totals: {
      invoices: invoices.length,
      taxable: round2(invoices.reduce((s, d) => s + d.totals.taxable, 0)),
      tax: round2(invoices.reduce((s, d) => s + d.totals.cgst + d.totals.sgst + d.totals.igst + d.totals.cess, 0)),
    },
  };
}

export function gstr3b(docs: Doc[], from: string, to: string) {
  const sum = (list: Doc[], sign = 1) => ({
    taxable: sign * list.reduce((s, d) => s + d.totals.taxable, 0),
    igst: sign * list.reduce((s, d) => s + d.totals.igst, 0),
    cgst: sign * list.reduce((s, d) => s + d.totals.cgst, 0),
    sgst: sign * list.reduce((s, d) => s + d.totals.sgst, 0),
    cess: sign * list.reduce((s, d) => s + d.totals.cess, 0),
  });
  const add = (a: ReturnType<typeof sum>, b: ReturnType<typeof sum>) => ({
    taxable: a.taxable + b.taxable, igst: a.igst + b.igst, cgst: a.cgst + b.cgst, sgst: a.sgst + b.sgst, cess: a.cess + b.cess,
  });
  const r2 = (x: ReturnType<typeof sum>) => ({ taxable: round2(x.taxable), igst: round2(x.igst), cgst: round2(x.cgst), sgst: round2(x.sgst), cess: round2(x.cess) });
  const salesDocs = docs.filter((d) => d.kind === "sales" && inRange(d, from, to));
  const purchaseDocs = docs.filter((d) => d.kind === "purchase" && inRange(d, from, to));
  const outward = r2(add(sum(salesDocs.filter((d) => d.type === "invoice")), sum(salesDocs.filter((d) => d.type === "credit_note"), -1)));
  const exemptOutward = round2(salesDocs.filter((d) => ["bill_of_supply", "export_invoice"].includes(d.type)).reduce((s, d) => s + d.totals.taxable, 0));
  const itc = r2(add(sum(purchaseDocs.filter((d) => d.type === "bill")), sum(purchaseDocs.filter((d) => d.type === "debit_note"), -1)));
  const payable = {
    igst: round2(Math.max(0, outward.igst - itc.igst)),
    cgst: round2(Math.max(0, outward.cgst - itc.cgst)),
    sgst: round2(Math.max(0, outward.sgst - itc.sgst)),
    cess: round2(Math.max(0, outward.cess - itc.cess)),
  };
  return { outward, exemptOutward, itc, payable, totalPayable: round2(payable.igst + payable.cgst + payable.sgst + payable.cess) };
}

export type ItcRow = { date: string; number: string; supplier: string; gstin: string; taxable: number; igst: number; cgst: number; sgst: number; cess: number };

export function itcReport(docs: Doc[], from: string, to: string): ItcRow[] {
  return docs
    .filter((d) => d.kind === "purchase" && d.type === "bill" && inRange(d, from, to))
    .map((d) => ({
      date: d.date, number: d.supplierInvoiceNo || d.number, supplier: d.partyName, gstin: d.partyGstin,
      taxable: d.totals.taxable, igst: d.totals.igst, cgst: d.totals.cgst, sgst: d.totals.sgst, cess: d.totals.cess,
    }));
}

// ---------- stock reports ----------

export type StockRow = {
  product: Product;
  variantId?: string;
  qty: number;
  avgCost: number;
  value: number;
  low: boolean;
};

export function stockSummary(products: Product[], movements: StockMovement[], warehouseId?: string): StockRow[] {
  const state = new Map<string, { qty: number; value: number; inQty: number; inValue: number }>();
  const wState = new Map<string, number>();
  for (const m of movements) {
    const k = `${m.productId}|${m.variantId ?? ""}`;
    const cur = state.get(k) ?? { qty: 0, value: 0, inQty: 0, inValue: 0 };
    if (m.type === "transfer_in" || m.type === "transfer_out") {
      // cost unchanged
    } else if (m.qty > 0) {
      cur.qty += m.qty;
      cur.value += m.qty * m.rate;
    } else {
      const avg = cur.qty > 0 ? cur.value / cur.qty : m.rate;
      cur.qty += m.qty;
      cur.value += m.qty * avg;
    }
    state.set(k, cur);
    if (!warehouseId || m.warehouseId === warehouseId) wState.set(k, (wState.get(k) ?? 0) + m.qty);
  }
  const rows: StockRow[] = [];
  for (const p of products) {
    if (p.isService) continue;
    const variants = p.variants.length ? p.variants.map((v) => v.id) : [undefined];
    for (const vid of variants) {
      const k = `${p.id}|${vid ?? ""}`;
      const s = state.get(k);
      const totalQty = s?.qty ?? 0;
      const avg = s && s.qty > 0 ? s.value / s.qty : p.purchasePrice;
      const qty = Math.round((wState.get(k) ?? 0) * 1000) / 1000;
      rows.push({ product: p, variantId: vid, qty, avgCost: round2(avg), value: round2(qty * avg), low: totalQty <= p.reorderLevel && p.reorderLevel > 0 });
    }
  }
  return rows;
}

/** FIFO value of remaining stock per product|variant key, as an alternative view to weighted average. */
export function fifoValues(movements: StockMovement[]): Map<string, number> {
  const layers = new Map<string, { qty: number; rate: number }[]>();
  for (const m of movements) {
    if (m.type === "transfer_in" || m.type === "transfer_out") continue;
    const k = `${m.productId}|${m.variantId ?? ""}`;
    const q = layers.get(k) ?? [];
    if (m.qty > 0) q.push({ qty: m.qty, rate: m.rate });
    else {
      let need = -m.qty;
      while (need > 1e-9 && q.length) {
        const take = Math.min(need, q[0].qty);
        q[0].qty -= take;
        need -= take;
        if (q[0].qty <= 1e-9) q.shift();
      }
    }
    layers.set(k, q);
  }
  return new Map([...layers].map(([k, q]) => [k, round2(q.reduce((s, l) => s + l.qty * l.rate, 0))]));
}

export function expiringBatches(movements: StockMovement[], products: Product[], withinDays: number, asOf: string) {
  const map = new Map<string, { productId: string; variantId?: string; warehouseId: string; batchNo: string; expiry: string; qty: number }>();
  for (const m of movements) {
    if (!m.batchNo || !m.expiry) continue;
    const k = `${m.productId}|${m.variantId ?? ""}|${m.warehouseId}|${m.batchNo}`;
    const cur = map.get(k) ?? { productId: m.productId, variantId: m.variantId, warehouseId: m.warehouseId, batchNo: m.batchNo, expiry: m.expiry, qty: 0 };
    cur.qty += m.qty;
    map.set(k, cur);
  }
  const limit = new Date(asOf + "T00:00:00");
  limit.setDate(limit.getDate() + withinDays);
  const lim = limit.toISOString().slice(0, 10);
  return [...map.values()]
    .filter((b) => b.qty > 0.0005 && b.expiry <= lim)
    .map((b) => ({ ...b, name: products.find((p) => p.id === b.productId)?.name ?? "", daysLeft: daysBetween(new Date(asOf + "T00:00:00"), new Date(b.expiry + "T00:00:00")) }))
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}

export type ItemProfitRow = { productId: string; name: string; qty: number; revenue: number; cost: number; profit: number; margin: number };

export function itemProfit(docs: Doc[], movements: StockMovement[], products: Product[], from: string, to: string): ItemProfitRow[] {
  const costByDoc = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "sale" || !m.refId) continue;
    const k = `${m.refId}|${m.productId}|${m.variantId ?? ""}`;
    costByDoc.set(k, (costByDoc.get(k) ?? 0) + -m.qty * m.rate);
  }
  const map = new Map<string, ItemProfitRow>();
  for (const d of docs) {
    if (d.kind !== "sales" || d.status !== "final" || !["invoice", "bill_of_supply", "export_invoice"].includes(d.type)) continue;
    if (d.date < from || d.date > to) continue;
    for (const it of d.items) {
      const rev = it.qty * it.rate * (1 - it.discountPct / 100);
      const cost = costByDoc.get(`${d.id}|${it.productId}|${it.variantId ?? ""}`) ?? 0;
      const cur = map.get(it.productId) ?? { productId: it.productId, name: products.find((p) => p.id === it.productId)?.name ?? it.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
      cur.qty += it.qty;
      cur.revenue += rev;
      cur.cost += cost;
      map.set(it.productId, cur);
    }
  }
  return [...map.values()]
    .map((r) => {
      const profit = r.revenue - r.cost;
      return { ...r, qty: Math.round(r.qty * 1000) / 1000, revenue: round2(r.revenue), cost: round2(r.cost), profit: round2(profit), margin: r.revenue ? round2((profit / r.revenue) * 100) : 0 };
    })
    .sort((a, b) => b.profit - a.profit);
}

// ---------- register ----------

export function register(docs: Doc[], kind: "sales" | "purchase", from: string, to: string) {
  const rows = docs.filter((d) => d.kind === kind && d.status === "final" && d.date >= from && d.date <= to && affects(kind, d.type)).sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
const affects = (kind: "sales" | "purchase", type: string) =>
  kind === "sales" ? ["invoice", "bill_of_supply", "export_invoice", "credit_note"].includes(type) : ["bill", "debit_note"].includes(type);

// ---------- dashboard ----------

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function dashboardStats(args: {
  docs: Doc[];
  accounts: Account[];
  journal: JournalEntry[];
  products: Product[];
  movements: StockMovement[];
  parties: Party[];
  asOf: string;
  fyFrom: string;
  fyTo: string;
}) {
  const { docs, accounts, journal, products, movements, parties, asOf, fyFrom, fyTo } = args;
  const sign = (d: Doc) => (d.type === "credit_note" || d.type === "debit_note" ? -1 : 1);
  const salesDocs = docs.filter((d) => d.kind === "sales" && d.status === "final" && affects("sales", d.type));
  const purchaseDocs = docs.filter((d) => d.kind === "purchase" && d.status === "final" && affects("purchase", d.type));
  const todaySales = round2(salesDocs.filter((d) => d.date === asOf).reduce((s, d) => s + sign(d) * d.totals.grandTotal, 0));
  const month = asOf.slice(0, 7);
  const monthSales = round2(salesDocs.filter((d) => monthKey(d.date) === month).reduce((s, d) => s + sign(d) * d.totals.grandTotal, 0));
  const totals = accountTotals(journal, undefined, asOf);
  const bal = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? naturalBalance(a, totals.get(id)) : 0;
  };
  const receivables = bal(SYS.debtors);
  const payables = bal(SYS.creditors);
  const cashBank = round2(accounts.filter((a) => a.group === "Cash in Hand" || a.group === "Bank Accounts").reduce((s, a) => s + naturalBalance(a, totals.get(a.id)), 0));
  const stockValue = bal(SYS.stock);
  const stockRows = stockSummary(products, movements);
  const lowStock = stockRows.filter((r) => r.low);
  const gst = gstr3b(docs, fyFrom, fyTo);
  // Monthly series across the FY.
  const months: { key: string; label: string; sales: number; purchases: number }[] = [];
  const start = new Date(fyFrom + "T00:00:00");
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleString("en-IN", { month: "short" }),
      sales: round2(salesDocs.filter((x) => monthKey(x.date) === key).reduce((s, x) => s + sign(x) * x.totals.taxable, 0)),
      purchases: round2(purchaseDocs.filter((x) => monthKey(x.date) === key).reduce((s, x) => s + sign(x) * x.totals.taxable, 0)),
    });
  }
  const fySales = salesDocs.filter((d) => d.date >= fyFrom && d.date <= fyTo && d.type !== "credit_note");
  const topProducts = new Map<string, { name: string; value: number }>();
  const topCustomers = new Map<string, { name: string; value: number }>();
  const categories = new Map<string, number>();
  for (const d of fySales) {
    for (const it of d.items) {
      const v = it.qty * it.rate * (1 - it.discountPct / 100);
      const p = topProducts.get(it.productId) ?? { name: it.name, value: 0 };
      p.value += v;
      topProducts.set(it.productId, p);
      const cat = products.find((x) => x.id === it.productId)?.category || "Uncategorised";
      categories.set(cat, (categories.get(cat) ?? 0) + v);
    }
    const key = d.partyId ?? "walkin";
    const c = topCustomers.get(key) ?? { name: d.partyName || "Walk-in customers", value: 0 };
    c.value += d.totals.taxable;
    topCustomers.set(key, c);
  }
  const rank = (m: Map<string, { name: string; value: number }>) => [...m.values()].map((x) => ({ ...x, value: round2(x.value) })).sort((a, b) => b.value - a.value).slice(0, 5);
  const overdue = docs.filter((d) => d.kind === "sales" && payStatus(d, asOf) === "overdue").sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 6);
  void parties;
  return {
    todaySales, monthSales, receivables, payables, cashBank, stockValue,
    lowStockCount: lowStock.length, lowStock: lowStock.slice(0, 6),
    gstPayable: gst.totalPayable, months,
    topProducts: rank(topProducts), topCustomers: rank(topCustomers),
    categoryMix: [...categories].map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value),
    overdue,
    expiring: expiringBatches(movements, products, 30, asOf).slice(0, 6),
  };
}
