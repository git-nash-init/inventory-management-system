import { describe, expect, it } from "vitest";
import { seedState, blankState } from "@/data/demo/seed";
import { RepoError } from "@/data/repo";
import {
  adjustStock,
  cancelDoc,
  convertDoc,
  createDoc,
  outstanding,
  payStatus,
  recordPayment,
  stockQty,
  type State,
} from "./engine";
import { aging, balanceSheet, gstr3b, partyBalances, profitAndLoss, trialBalance } from "./reports";
import type { DocInput, Product } from "./types";

function product(s: State, over: Partial<Product> = {}): Product {
  const p: Product = {
    id: "p-" + (s.products.length + 1), name: "Widget", sku: "W" + s.products.length, barcode: "", hsn: "8501", isService: false, gstRate: 18,
    cessPct: 0, unit: "PCS", mrp: 0, salePrice: 200, wholesalePrice: 0, purchasePrice: 100, openingStock: 0, reorderLevel: 0, category: "",
    brand: "", trackBatch: false, trackSerial: false, variants: [], active: true, ...over,
  };
  s.products.push(p);
  return p;
}

function base(s: State): Omit<DocInput, "kind" | "type" | "items" | "partyId" | "partyName"> {
  return {
    date: "2026-11-01", partyGstin: "", placeOfSupply: s.business.stateCode, reverseCharge: false, tcsPct: 0, notes: "", terms: "",
    warehouseId: "wh-main",
  };
}

const item = (p: Product, qty: number, rate = p.salePrice) => ({
  productId: p.id, name: p.name, hsn: p.hsn, qty, unit: p.unit, rate, discountPct: 0, gstRate: p.gstRate, cessPct: 0,
});

function setup() {
  const s = blankState();
  s.parties.push(
    { id: "c1", type: "customer", name: "Cust", gstin: "", stateCode: "27", phone: "", email: "", address: "", creditLimit: 0, creditDays: 10, openingBalance: 0, priceList: "retail", active: true },
    { id: "c2", type: "customer", name: "Far Cust", gstin: "", stateCode: "29", phone: "", email: "", address: "", creditLimit: 0, creditDays: 10, openingBalance: 0, priceList: "retail", active: true },
    { id: "s1", type: "supplier", name: "Supp", gstin: "", stateCode: "27", phone: "", email: "", address: "", creditLimit: 0, creditDays: 10, openingBalance: 0, priceList: "retail", active: true },
  );
  const p = product(s);
  createDoc(s, { ...base(s), kind: "purchase", type: "bill", partyId: "s1", partyName: "Supp", items: [item(p, 50, 100)] }, "t");
  return { s, p };
}

describe("seeded demo books", () => {
  it("balance by construction and report consistently", () => {
    const s = seedState();
    const tb = trialBalance(s.accounts, s.journal);
    expect(tb.balanced).toBe(true);
    expect(tb.debit).toBeGreaterThan(0);
    const bs = balanceSheet(s.accounts, s.journal, "2999-12-31", "2000-01-01");
    expect(bs.balanced).toBe(true);
    const pl = profitAndLoss(s.accounts, s.journal, "2000-01-01", "2999-12-31");
    expect(pl.netSales).toBeGreaterThan(0);
  });
  it("never has negative stock", () => {
    const s = seedState();
    for (const p of s.products) {
      for (const wh of s.warehouses) expect(stockQty(s, p.id, undefined, wh.id)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("purchase bill", () => {
  it("adds stock at cost and credits the supplier", () => {
    const { s, p } = setup();
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(50);
    const bal = partyBalances(s.parties, s.journal);
    expect(bal.get("s1")).toBe(5900); // 5000 + 18% GST
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
});

describe("sales invoice", () => {
  it("reduces stock, posts sales, tax and COGS, and tracks the receivable", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 10)] }, "t");
    expect(d.number).toMatch(/^INV\/\d\d-\d\d\/0001$/);
    expect(d.supply).toBe("intra");
    expect(d.totals.cgst).toBe(180);
    expect(d.totals.grandTotal).toBe(2360);
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(40);
    expect(partyBalances(s.parties, s.journal).get("c1")).toBe(2360);
    const pl = profitAndLoss(s.accounts, s.journal, "2026-01-01", "2026-12-31");
    expect(pl.netSales).toBe(2000);
    expect(pl.cogs).toBe(1000);
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
  it("uses IGST across states", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), placeOfSupply: "29", kind: "sales", type: "invoice", partyId: "c2", partyName: "Far Cust", items: [item(p, 1)] }, "t");
    expect(d.supply).toBe("inter");
    expect(d.totals.igst).toBe(36);
    expect(d.totals.cgst).toBe(0);
  });
  it("refuses to sell more than is in stock and leaves state unchanged", () => {
    const { s, p } = setup();
    expect(() => createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 51)] }, "t")).toThrow(RepoError);
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(50);
  });
  it("numbers invoices in sequence per financial year", () => {
    const { s, p } = setup();
    const a = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    const b = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    const c = createDoc(s, { ...base(s), date: "2027-04-02", kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    expect(a.number.endsWith("/0001")).toBe(true);
    expect(b.number.endsWith("/0002")).toBe(true);
    expect(c.number).toBe("INV/27-28/0001");
  });
  it("treats a walk-in sale as paid cash", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyName: "Walk-in", items: [item(p, 2)] }, "t");
    expect(payStatus(d, "2026-12-01")).toBe("paid");
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
});

describe("payments and status", () => {
  it("moves unpaid to partial to paid, and flags overdue", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), dueDate: "2026-11-11", kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 10)] }, "t");
    expect(payStatus(d, "2026-11-05")).toBe("unpaid");
    expect(payStatus(d, "2026-11-20")).toBe("overdue");
    recordPayment(s, { direction: "in", date: "2026-11-05", partyId: "c1", amount: 1000, mode: "upi", reference: "", accountId: "acc-bank", allocations: [{ docId: d.id, amount: 1000 }], notes: "" }, "t");
    expect(payStatus(d, "2026-11-05")).toBe("partial");
    expect(outstanding(d)).toBe(1360);
    recordPayment(s, { direction: "in", date: "2026-11-06", partyId: "c1", amount: 1360, mode: "cash", reference: "", accountId: "acc-cash", allocations: [{ docId: d.id, amount: 1360 }], notes: "" }, "t");
    expect(payStatus(d, "2026-11-20")).toBe("paid");
    expect(partyBalances(s.parties, s.journal).get("c1")).toBe(0);
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
  it("rejects over-allocation", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    expect(() => recordPayment(s, { direction: "in", date: "2026-11-05", partyId: "c1", amount: 99999, mode: "cash", reference: "", accountId: "acc-cash", allocations: [{ docId: d.id, amount: 99999 }], notes: "" }, "t")).toThrow(RepoError);
  });
});

describe("cancel, convert, adjust", () => {
  it("cancelling reverses stock and the books", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 10)] }, "t");
    cancelDoc(s, d.id, "t");
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(50);
    expect(partyBalances(s.parties, s.journal).get("c1")).toBe(0);
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
    expect(d.status).toBe("cancelled");
  });
  it("blocks cancelling an invoice that has payments", () => {
    const { s, p } = setup();
    const d = createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    recordPayment(s, { direction: "in", date: "2026-11-05", partyId: "c1", amount: 100, mode: "cash", reference: "", accountId: "acc-cash", allocations: [{ docId: d.id, amount: 100 }], notes: "" }, "t");
    expect(() => cancelDoc(s, d.id, "t")).toThrow(RepoError);
  });
  it("converts a quotation to an invoice without touching stock until then", () => {
    const { s, p } = setup();
    const q = createDoc(s, { ...base(s), kind: "sales", type: "quotation", partyId: "c1", partyName: "Cust", items: [item(p, 5)] }, "t");
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(50);
    const inv = convertDoc(s, q.id, "invoice", "t");
    expect(inv.refDocId).toBe(q.id);
    expect(q.status).toBe("converted");
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(45);
  });
  it("posts a stock loss for a negative adjustment", () => {
    const { s, p } = setup();
    adjustStock(s, { date: "2026-11-02", productId: p.id, warehouseId: "wh-main", qty: -3, reason: "damage", note: "" }, "t");
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(47);
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
});

describe("returns and GST summary", () => {
  it("a credit note restores stock and reduces GSTR-3B outward tax", () => {
    const { s, p } = setup();
    createDoc(s, { ...base(s), kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 10)] }, "t");
    createDoc(s, { ...base(s), kind: "sales", type: "credit_note", partyId: "c1", partyName: "Cust", items: [item(p, 2)] }, "t");
    expect(stockQty(s, p.id, undefined, "wh-main")).toBe(42);
    const g = gstr3b(s.docs, "2026-11-01", "2026-11-30");
    expect(g.outward.taxable).toBe(1600);
    expect(g.outward.cgst).toBe(144);
    expect(g.itc.cgst).toBe(450); // from the 5000 purchase
    expect(g.totalPayable).toBe(0);
    expect(trialBalance(s.accounts, s.journal).balanced).toBe(true);
  });
  it("ages receivables into buckets", () => {
    const { s, p } = setup();
    createDoc(s, { ...base(s), date: "2026-08-01", dueDate: "2026-08-11", kind: "sales", type: "invoice", partyId: "c1", partyName: "Cust", items: [item(p, 1)] }, "t");
    const rows = aging(s.docs, "sales", "2026-11-20"); // 101 days past due
    expect(rows).toHaveLength(1);
    expect(rows[0].over90).toBe(236);
    expect(aging(s.docs, "sales", "2026-11-08")[0].d90).toBe(236); // 89 days past due
  });
});
