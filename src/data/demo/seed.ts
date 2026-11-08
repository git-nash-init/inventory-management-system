import { defaultAccounts } from "@/domain/accounts";
import {
  DEFAULT_PREFIXES,
  createDoc,
  createExpense,
  recordPayment,
  savePartyOpening,
  saveProductOpening,
  uid,
  type State,
} from "@/domain/engine";
import type { Business, DocInput, DocItem, Member, Party, Product, Warehouse } from "@/domain/types";
import { gstinCheckChar } from "@/lib/gst/gstin";
import { toISODate } from "@/lib/format/date";

const gstin = (first14: string) => first14 + gstinCheckChar(first14);

export function emptyBusiness(): Business {
  return {
    id: "biz-demo",
    name: "Shree Ganesh Traders",
    legalName: "Shree Ganesh Traders",
    gstin: gstin("27AAAPG1234C1Z"),
    pan: "AAAPG1234C",
    stateCode: "27",
    address: "Shop 12, Market Yard, Pune",
    city: "Pune",
    pincode: "411037",
    phone: "9800000000",
    email: "accounts@example.com",
    bankName: "State Bank of India",
    bankAccount: "00000012345678",
    ifsc: "SBIN0000300",
    upiId: "shreeganesh@sbi",
    taxScheme: "regular",
    terms: "Goods once sold will not be taken back. Payment due within the credit period. Subject to Pune jurisdiction.",
    invoiceTemplate: "a4",
    valuation: "avg",
    tcsPct: 0,
    prefixes: { ...DEFAULT_PREFIXES },
    sequences: {},
  };
}

export function blankState(): State {
  return {
    business: emptyBusiness(),
    products: [],
    warehouses: [{ id: "wh-main", name: "Main godown", address: "Market Yard, Pune", isDefault: true }],
    parties: [],
    accounts: defaultAccounts(),
    movements: [],
    docs: [],
    payments: [],
    journal: [],
    expenses: [],
    members: [
      { id: "mem-owner", email: "owner@example.com", name: "Demo Owner", role: "owner", active: true, createdAt: new Date().toISOString() },
    ],
    audit: [],
    counters: {},
  };
}

const P = (
  name: string, sku: string, hsn: string, gst: number, unit: string, purchase: number, sale: number,
  category: string, brand: string, extra: Partial<Product> = {},
): Product => ({
  id: uid(), name, sku, barcode: "89000" + sku.replace(/\D/g, "").padStart(8, "0"), hsn, isService: false, gstRate: gst, cessPct: 0, unit,
  mrp: Math.round(sale * 1.12), salePrice: sale, wholesalePrice: Math.round(sale * 0.93), purchasePrice: purchase, openingStock: 0,
  reorderLevel: 10, category, brand, trackBatch: false, trackSerial: false, variants: [], active: true, ...extra,
});

const itemOf = (p: Product, qty: number, rate?: number, extra: Partial<DocItem> = {}): DocItem => ({
  productId: p.id, name: p.name, hsn: p.hsn, qty, unit: p.unit, rate: rate ?? p.salePrice, discountPct: 0,
  gstRate: p.gstRate, cessPct: p.cessPct, ...extra,
});

/** Builds a realistic demo business using the same engine the app uses, so books balance by construction. */
export function seedState(): State {
  const s = blankState();
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return toISODate(d);
  };

  s.warehouses.push({ id: "wh-shop", name: "Shop counter", address: "Market Yard, Pune", isDefault: false } satisfies Warehouse);

  const products = [
    P("Basmati rice 25 kg", "RICE25", "1006", 5, "BAG", 1450, 1680, "Grocery", "India Gate", { reorderLevel: 20 }),
    P("Toor dal 1 kg", "DAL1", "0713", 5, "KG", 128, 152, "Grocery", "Tata Sampann", { reorderLevel: 40 }),
    P("Sunflower oil 1 L", "OIL1", "1512", 5, "PCS", 118, 139, "Grocery", "Fortune", { reorderLevel: 30 }),
    P("Wheat atta 10 kg", "ATTA10", "1101", 0, "BAG", 395, 455, "Grocery", "Aashirvaad", { reorderLevel: 25 }),
    P("Bath soap pack of 4", "SOAP4", "3401", 18, "PKT", 118, 156, "Personal care", "Dettol", { reorderLevel: 25 }),
    P("Shampoo 340 ml", "SHAM340", "3305", 18, "PCS", 190, 245, "Personal care", "Clinic Plus", { reorderLevel: 20 }),
    P("Notebook A4 200 pages", "NB200", "4820", 12, "PCS", 46, 65, "Stationery", "Classmate", { reorderLevel: 60 }),
    P("Ball pen box of 50", "PEN50", "9608", 12, "BOX", 210, 285, "Stationery", "Cello", { reorderLevel: 15 }),
    P("LED bulb 9 W", "LED9", "8539", 12, "PCS", 58, 89, "Electricals", "Philips", { reorderLevel: 40, trackSerial: false }),
    P("Extension board 4 socket", "EXT4", "8536", 18, "PCS", 260, 390, "Electricals", "Anchor", { reorderLevel: 12 }),
    P("Paracetamol 500 mg strip", "PARA", "3004", 12, "STRIP", 14, 22, "Pharmacy", "Generic", { reorderLevel: 100, trackBatch: true }),
    P("Delivery charges", "DELIV", "9965", 18, "NOS", 0, 150, "Services", "", { isService: true, reorderLevel: 0 }),
  ];
  for (const p of products) {
    s.products.push(p);
  }
  const [rice, dal, oil, atta, soap, shampoo, notebook, pen, led, ext, para, delivery] = products;

  // Cap and open: capital contribution so cash and bank exist.
  s.journal.push({
    id: uid(), date: day(200), voucherType: "opening", number: "OPN/seed/0001", narration: "Capital introduced",
    lines: [
      { accountId: "acc-bank", debit: 500000, credit: 0 },
      { accountId: "acc-cash", debit: 50000, credit: 0 },
      { accountId: "acc-capital", debit: 0, credit: 550000 },
    ],
    createdAt: new Date().toISOString(),
  });

  const customers: Party[] = [
    { id: uid(), type: "customer", name: "Patil Kirana Stores", gstin: gstin("27ABCPP1234F1Z"), stateCode: "27", phone: "9811111111", email: "", address: "Kothrud, Pune", creditLimit: 100000, creditDays: 15, openingBalance: 8500, priceList: "wholesale", active: true },
    { id: uid(), type: "customer", name: "Mehta Departmental Store", gstin: gstin("24AAACM5678K1Z"), stateCode: "24", phone: "9822222222", email: "", address: "Navrangpura, Ahmedabad", creditLimit: 200000, creditDays: 30, openingBalance: 0, priceList: "wholesale", active: true },
    { id: uid(), type: "customer", name: "Sai Medical and General", gstin: gstin("27AAECS4321M1Z"), stateCode: "27", phone: "9833333333", email: "", address: "Hadapsar, Pune", creditLimit: 50000, creditDays: 7, openingBalance: 0, priceList: "retail", active: true },
    { id: uid(), type: "customer", name: "Reddy Supermart", gstin: gstin("36AABCR9876L1Z"), stateCode: "36", phone: "9844444444", email: "", address: "Madhapur, Hyderabad", creditLimit: 150000, creditDays: 30, openingBalance: 0, priceList: "wholesale", active: true },
    { id: uid(), type: "customer", name: "Kulkarni Enterprises", gstin: "", stateCode: "27", phone: "9855555555", email: "", address: "Aundh, Pune", creditLimit: 25000, creditDays: 0, openingBalance: 0, priceList: "retail", active: true },
  ];
  const suppliers: Party[] = [
    { id: uid(), type: "supplier", name: "Agro Foods Distributors", gstin: gstin("27AABCA1111D1Z"), stateCode: "27", phone: "9700000001", email: "", address: "Gultekdi, Pune", creditLimit: 0, creditDays: 30, openingBalance: 0, priceList: "retail", active: true },
    { id: uid(), type: "supplier", name: "Bharat Stationers Wholesale", gstin: gstin("27AAFCB2222E1Z"), stateCode: "27", phone: "9700000002", email: "", address: "Budhwar Peth, Pune", creditLimit: 0, creditDays: 45, openingBalance: 0, priceList: "retail", active: true },
    { id: uid(), type: "supplier", name: "Delhi Electricals Pvt Ltd", gstin: gstin("07AAGCD3333F1Z"), stateCode: "07", phone: "9700000003", email: "", address: "Lajpat Nagar, Delhi", creditLimit: 0, creditDays: 30, openingBalance: 0, priceList: "retail", active: true },
    { id: uid(), type: "supplier", name: "Healthline Pharma Distributors", gstin: gstin("27AAHCH4444G1Z"), stateCode: "27", phone: "9700000004", email: "", address: "Shivajinagar, Pune", creditLimit: 0, creditDays: 15, openingBalance: 0, priceList: "retail", active: true },
  ];
  for (const p of [...customers, ...suppliers]) {
    s.parties.push(p);
    savePartyOpening(s, p);
  }
  const [patil, mehta, sai, reddy, kulkarni] = customers;
  const [agro, bharat, delhi, health] = suppliers;

  const bill = (offset: number, sup: Party, items: DocItem[], no: string): DocInput => ({
    kind: "purchase", type: "bill", date: day(offset), dueDate: day(offset - sup.creditDays), partyId: sup.id, partyName: sup.name,
    partyGstin: sup.gstin, placeOfSupply: sup.stateCode, reverseCharge: false, items, tcsPct: 0, notes: "", terms: "", warehouseId: "wh-main",
    supplierInvoiceNo: no,
  });
  const inv = (offset: number, c: Party | undefined, items: DocItem[], wh = "wh-main"): DocInput => ({
    kind: "sales", type: "invoice", date: day(offset), dueDate: c ? day(offset - c.creditDays) : undefined, partyId: c?.id,
    partyName: c?.name ?? "Walk-in customer", partyGstin: c?.gstin ?? "", placeOfSupply: c?.stateCode ?? "27", reverseCharge: false, items,
    tcsPct: 0, notes: "", terms: s.business.terms, warehouseId: wh,
  });

  const actor = "Demo";
  // Stock up across several months (oldest first so the 12-month chart has a shape).
  const buys: [number, Party, DocItem[], string][] = [
    [190, agro, [itemOf(rice, 80, 1450), itemOf(dal, 300, 128), itemOf(oil, 240, 118), itemOf(atta, 120, 395)], "AFD/2411"],
    [175, bharat, [itemOf(notebook, 600, 46), itemOf(pen, 60, 210)], "BS/0873"],
    [160, delhi, [itemOf(led, 400, 58), itemOf(ext, 80, 260)], "DE/5521"],
    [150, health, [itemOf(para, 2000, 14, { batchNo: "PC-2406", expiry: day(-300) }), itemOf(soap, 150, 118), itemOf(shampoo, 100, 190)], "HP/1190"],
    [100, agro, [itemOf(rice, 60, 1460), itemOf(dal, 200, 130), itemOf(oil, 150, 120)], "AFD/2498"],
    [60, health, [itemOf(para, 1500, 14, { batchNo: "PC-2410", expiry: day(-20) })], "HP/1244"],
    [30, bharat, [itemOf(notebook, 300, 47)], "BS/0911"],
  ];
  for (const [off, sup, items, no] of buys) createDoc(s, bill(off, sup, items, no), actor);

  // Spread sales over the months.
  const sells: [number, Party | undefined, DocItem[]][] = [
    [170, patil, [itemOf(rice, 10), itemOf(dal, 60), itemOf(oil, 40)]],
    [155, mehta, [itemOf(led, 100), itemOf(ext, 20), itemOf(notebook, 120)]],
    [140, sai, [itemOf(para, 400), itemOf(soap, 30)]],
    [125, reddy, [itemOf(rice, 15), itemOf(atta, 30), itemOf(dal, 80)]],
    [110, undefined, [itemOf(soap, 4), itemOf(shampoo, 3)]],
    [95, patil, [itemOf(atta, 25), itemOf(oil, 50), itemOf(dal, 40)]],
    [80, mehta, [itemOf(pen, 20), itemOf(notebook, 150)]],
    [70, kulkarni, [itemOf(led, 30), itemOf(delivery, 1)]],
    [55, reddy, [itemOf(rice, 20), itemOf(oil, 60)]],
    [45, sai, [itemOf(para, 600), itemOf(shampoo, 12)]],
    [35, patil, [itemOf(rice, 12), itemOf(dal, 70), itemOf(atta, 20)]],
    [25, mehta, [itemOf(ext, 25), itemOf(led, 60)]],
    [18, undefined, [itemOf(notebook, 6), itemOf(pen, 1)]],
    [12, reddy, [itemOf(atta, 40), itemOf(soap, 40)]],
    [6, patil, [itemOf(oil, 30), itemOf(dal, 50)]],
    [2, kulkarni, [itemOf(led, 20), itemOf(ext, 5)]],
    [0, undefined, [itemOf(soap, 2), itemOf(dal, 3)]],
  ];
  const made = sells.map(([off, c, items]) => createDoc(s, inv(off, c, items), actor));

  // Payments: settle most early invoices, leave some partial and overdue.
  const pay = (docIdx: number, fraction: number, mode: "cash" | "upi" | "bank" | "cheque", offset: number) => {
    const d = made[docIdx];
    if (!d.partyId) return;
    const amount = Math.round(d.totals.grandTotal * fraction * 100) / 100;
    recordPayment(
      s,
      { direction: "in", date: day(offset), partyId: d.partyId, amount, mode, reference: mode === "upi" ? "UPI" : "", accountId: mode === "cash" ? "acc-cash" : "acc-bank", allocations: [{ docId: d.id, amount }], notes: "" },
      actor,
    );
  };
  pay(0, 1, "bank", 160);
  pay(1, 1, "bank", 140);
  pay(2, 1, "upi", 135);
  pay(3, 0.6, "bank", 100);
  pay(5, 1, "bank", 80);
  pay(6, 1, "cheque", 60);
  pay(8, 0.5, "bank", 30);
  pay(9, 1, "upi", 40);
  pay(10, 1, "bank", 25);

  // Pay suppliers.
  const billsMade = s.docs.filter((d) => d.kind === "purchase" && d.type === "bill");
  for (const b of billsMade.slice(0, 4)) {
    recordPayment(s, { direction: "out", date: day(10), partyId: b.partyId!, amount: b.totals.grandTotal, mode: "bank", reference: "NEFT", accountId: "acc-bank", allocations: [{ docId: b.id, amount: b.totals.grandTotal }], notes: "" }, actor);
  }

  createExpense(s, { date: day(28), category: "Rent", accountId: "acc-rent", payFromAccountId: "acc-bank", amount: 18000, gstAmount: 0, vendor: "Market Yard Trust", notes: "Shop rent" }, actor);
  createExpense(s, { date: day(20), category: "Electricity", accountId: "acc-electric", payFromAccountId: "acc-bank", amount: 4200, gstAmount: 0, vendor: "MSEDCL", notes: "" }, actor);
  createExpense(s, { date: day(8), category: "Transport and freight", accountId: "acc-transport", payFromAccountId: "acc-cash", amount: 2500, gstAmount: 0, vendor: "Local transport", notes: "" }, actor);

  // A quotation and an order to show the conversion flow.
  createDoc(s, { ...inv(3, mehta, [itemOf(rice, 30), itemOf(atta, 40)]), type: "quotation" }, actor);
  createDoc(s, { ...inv(1, reddy, [itemOf(oil, 80), itemOf(dal, 100)]), type: "order" }, actor);

  const members: Member[] = [
    ...s.members,
    { id: "mem-mgr", email: "manager@example.com", name: "Asha Kulkarni", role: "manager", active: true, createdAt: new Date().toISOString() },
    { id: "mem-acc", email: "accounts@example.com", name: "Rohit Shah", role: "accountant", active: true, createdAt: new Date().toISOString() },
    { id: "mem-sales", email: "sales@example.com", name: "Imran Sheikh", role: "sales", active: true, createdAt: new Date().toISOString() },
    { id: "mem-store", email: "store@example.com", name: "Dinesh More", role: "storekeeper", active: true, createdAt: new Date().toISOString() },
  ];
  s.members = members;
  // Opening stock value for products is zero; ensure helper is referenced to keep API surface honest.
  void saveProductOpening;
  s.audit = s.audit.slice(0, 200);
  return s;
}
