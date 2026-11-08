import type { State } from "@/domain/engine";
import type {
  Account,
  AuditEntry,
  Business,
  Doc,
  DocItem,
  Expense,
  JournalEntry,
  Member,
  Party,
  Payment,
  Product,
  StockMovement,
  Variant,
  Warehouse,
} from "@/domain/types";

type Row = Record<string, unknown>;

// ---------- case conversion ----------

export const toSnakeKey = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
export const toCamelKey = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Shallow key conversion. jsonb columns keep their inner keys untouched. */
export function snake(obj: Row): Row {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnakeKey(k), v]));
}
export function camel<T = Row>(obj: Row): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamelKey(k), v])) as T;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const orNull = (v: unknown) => (v === "" || v === undefined ? null : v);

// ---------- rows -> domain ----------

export function businessFromRow(r: Row, sequences: { series: string; fy: number; last: number }[] = []): Business {
  const c = camel<Row>(r);
  return {
    id: String(c.id), name: String(c.name), legalName: String(c.legalName ?? ""), gstin: String(c.gstin ?? ""), pan: String(c.pan ?? ""),
    stateCode: String(c.stateCode), address: String(c.address ?? ""), city: String(c.city ?? ""), pincode: String(c.pincode ?? ""),
    phone: String(c.phone ?? ""), email: String(c.email ?? ""), logoDataUrl: (c.logoDataUrl as string) ?? undefined,
    signatureDataUrl: (c.signatureDataUrl as string) ?? undefined, bankName: String(c.bankName ?? ""), bankAccount: String(c.bankAccount ?? ""),
    ifsc: String(c.ifsc ?? ""), upiId: String(c.upiId ?? ""), taxScheme: c.taxScheme as Business["taxScheme"], terms: String(c.terms ?? ""),
    invoiceTemplate: c.invoiceTemplate as Business["invoiceTemplate"], valuation: c.valuation as Business["valuation"], tcsPct: num(c.tcsPct),
    prefixes: (c.prefixes as Record<string, string>) ?? {},
    sequences: Object.fromEntries(sequences.map((s) => [`${s.series}|${s.fy}`, s.last])),
  };
}

export function productFromRow(r: Row, variants: Row[] = []): Product {
  const c = camel<Row>(r);
  return {
    id: String(c.id), name: String(c.name), sku: String(c.sku ?? ""), barcode: String(c.barcode ?? ""), hsn: String(c.hsn ?? ""), isService: Boolean(c.isService),
    gstRate: num(c.gstRate), cessPct: num(c.cessPct), unit: String(c.unit), altUnit: (c.altUnit as string) ?? undefined,
    altFactor: c.altFactor === null || c.altFactor === undefined ? undefined : num(c.altFactor), mrp: num(c.mrp), salePrice: num(c.salePrice),
    wholesalePrice: num(c.wholesalePrice), purchasePrice: num(c.purchasePrice), openingStock: num(c.openingStock), reorderLevel: num(c.reorderLevel),
    category: String(c.category ?? ""), brand: String(c.brand ?? ""), imageUrl: (c.imageUrl as string) ?? undefined, trackBatch: Boolean(c.trackBatch),
    trackSerial: Boolean(c.trackSerial), active: Boolean(c.active),
    variants: variants.map((v) => {
      const x = camel<Row>(v);
      return { id: String(x.id), name: String(x.name), sku: String(x.sku ?? ""), barcode: String(x.barcode ?? ""), salePrice: x.salePrice === null || x.salePrice === undefined ? undefined : num(x.salePrice) } satisfies Variant;
    }),
  };
}

export function partyFromRow(r: Row): Party {
  const c = camel<Row>(r);
  return {
    id: String(c.id), type: c.type as Party["type"], name: String(c.name), gstin: String(c.gstin ?? ""), stateCode: String(c.stateCode), phone: String(c.phone ?? ""),
    email: String(c.email ?? ""), address: String(c.address ?? ""), creditLimit: num(c.creditLimit), creditDays: num(c.creditDays), openingBalance: num(c.openingBalance),
    priceList: c.priceList as Party["priceList"], active: Boolean(c.active),
  };
}

export const warehouseFromRow = (r: Row): Warehouse => ({ id: String(r.id), name: String(r.name), address: String(r.address ?? ""), isDefault: Boolean(r.is_default) });

export const accountFromRow = (r: Row): Account => ({ id: String(r.id), code: String(r.code), name: String(r.name), group: r.group as Account["group"], nature: r.nature as Account["nature"], system: Boolean(r.system) });

export function movementFromRow(r: Row): StockMovement {
  const c = camel<Row>(r);
  return {
    id: String(c.id), date: String(c.date), productId: String(c.productId), variantId: (c.variantId as string) ?? undefined, warehouseId: String(c.warehouseId),
    batchNo: (c.batchNo as string) ?? undefined, expiry: (c.expiry as string) ?? undefined, qty: num(c.qty), rate: num(c.rate), type: c.type as StockMovement["type"],
    refType: (c.refType as string) ?? undefined, refId: (c.refId as string) ?? undefined, refNumber: (c.refNumber as string) ?? undefined, reason: (c.reason as string) ?? undefined,
  };
}

export function docFromRow(kind: "sales" | "purchase", r: Row, items: Row[], attachmentUrl?: string): Doc {
  const c = camel<Row>(r);
  return {
    id: String(c.id), kind, type: c.type as Doc["type"], number: String(c.number), supplierInvoiceNo: (c.supplierInvoiceNo as string) ?? undefined, date: String(c.date),
    dueDate: (c.dueDate as string) ?? undefined, partyId: (c.partyId as string) ?? undefined, partyName: String(c.partyName ?? ""), partyGstin: String(c.partyGstin ?? ""),
    placeOfSupply: String(c.placeOfSupply), supply: c.supply as Doc["supply"], reverseCharge: Boolean(c.reverseCharge),
    items: items.slice().sort((a, b) => num(a.line_no) - num(b.line_no)).map((i) => {
      const x = camel<Row>(i);
      return {
        productId: String(x.productId), variantId: (x.variantId as string) ?? undefined, name: String(x.name), hsn: String(x.hsn ?? ""), qty: num(x.qty), unit: String(x.unit),
        rate: num(x.rate), discountPct: num(x.discountPct), gstRate: num(x.gstRate), cessPct: num(x.cessPct), batchNo: (x.batchNo as string) ?? undefined,
        expiry: (x.expiry as string) ?? undefined, serials: (x.serials as string[]) ?? undefined, warehouseId: (x.warehouseId as string) ?? undefined,
      } satisfies DocItem;
    }),
    totals: c.totals as Doc["totals"], tcsPct: num(c.tcsPct), notes: String(c.notes ?? ""), terms: String(c.terms ?? ""), status: c.status as Doc["status"], paid: num(c.paid),
    refDocId: (c.refDocId as string) ?? undefined, warehouseId: String(c.warehouseId), attachmentName: (c.attachmentName as string) ?? undefined, attachmentDataUrl: attachmentUrl,
    einvoice: (c.einvoice as Doc["einvoice"]) ?? {}, ewayBillNo: (c.ewayBillNo as string) ?? undefined, createdAt: String(c.createdAt), createdBy: String(c.createdBy ?? ""),
  };
}

export function journalFromRow(r: Row, lines: Row[]): JournalEntry {
  const c = camel<Row>(r);
  return {
    id: String(c.id), date: String(c.date), voucherType: c.voucherType as JournalEntry["voucherType"], number: String(c.number), narration: String(c.narration ?? ""),
    refType: (c.refType as string) ?? undefined, refId: (c.refId as string) ?? undefined, cleared: (c.cleared as Record<string, string>) ?? {}, createdAt: String(c.createdAt),
    lines: lines.slice().sort((a, b) => num(a.line_no) - num(b.line_no)).map((l) => ({ accountId: String(l.account_id), partyId: (l.party_id as string) ?? undefined, debit: num(l.debit), credit: num(l.credit), narration: (l.narration as string) ?? undefined })),
  };
}

export function paymentFromRow(r: Row, allocs: Row[]): Payment {
  const c = camel<Row>(r);
  return {
    id: String(c.id), number: String(c.number), direction: c.direction as Payment["direction"], date: String(c.date), partyId: String(c.partyId), partyName: String(c.partyName ?? ""),
    amount: num(c.amount), mode: c.mode as Payment["mode"], reference: String(c.reference ?? ""), accountId: String(c.accountId), notes: String(c.notes ?? ""), createdAt: String(c.createdAt),
    allocations: allocs.map((a) => ({ docId: String(a.doc_id), amount: num(a.amount) })),
  };
}

export function expenseFromRow(r: Row, attachmentUrl?: string): Expense {
  const c = camel<Row>(r);
  return {
    id: String(c.id), number: String(c.number), date: String(c.date), category: String(c.category), accountId: String(c.accountId), payFromAccountId: String(c.payFromAccountId),
    amount: num(c.amount), gstAmount: num(c.gstAmount), vendor: String(c.vendor ?? ""), notes: String(c.notes ?? ""), attachmentName: (c.attachmentName as string) ?? undefined,
    attachmentDataUrl: attachmentUrl, createdAt: String(c.createdAt),
  };
}

export const auditFromRow = (r: Row): AuditEntry => ({ id: String(r.id), at: String(r.at), actor: String(r.actor), action: String(r.action), entity: String(r.entity), entityId: (r.entity_id as string) ?? undefined, detail: String(r.detail ?? "") });

export const memberFromRow = (r: Row): Member => ({ id: String(r.id), email: String(r.email), name: String(r.name ?? ""), role: r.role as Member["role"], active: Boolean(r.active), createdAt: String(r.created_at) });

// ---------- domain diff -> commit_changes payload ----------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function productRow(p: Product): Row {
  const { variants, ...rest } = p;
  return { ...snake(rest), variants: variants.map((v) => snake(v as unknown as Row)) };
}

function docRow(d: Doc, attachmentPath?: string): Row {
  const { kind, items, attachmentDataUrl, createdAt, createdBy, ...rest } = d;
  void kind;
  void attachmentDataUrl;
  void createdAt;
  void createdBy;
  const row = snake(rest as unknown as Row);
  row.due_date = orNull(row.due_date);
  row.attachment_path = attachmentPath;
  row.items = items.map((i) => {
    const r = snake(i as unknown as Row);
    r.expiry = orNull(r.expiry);
    r.batch_no = orNull(r.batch_no);
    return r;
  });
  return row;
}

export type PayloadOptions = {
  module: "dashboard" | "inventory" | "sales" | "purchases" | "accounting" | "reports" | "settings" | "users";
  action: "view" | "create" | "edit" | "delete";
  /** Storage path per document or expense id, when a file was uploaded. */
  attachmentPaths?: Record<string, string>;
};

/**
 * Compares the state before and after running an engine function and returns what the database must apply.
 * Everything here is append-only except document status and payment totals, which is exactly what the engine does.
 */
export function buildPayload(before: State, after: State, opts: PayloadOptions): Row {
  const beforeDocs = new Map(before.docs.map((d) => [d.id, d]));
  const docs: Row[] = [];
  const updates: Row[] = [];
  for (const d of after.docs) {
    const old = beforeDocs.get(d.id);
    const full = !old || old.status === "draft";
    if (full) {
      if (!old || !same(old, d)) docs.push({ ...docRow(d, opts.attachmentPaths?.[d.id]), _kind: d.kind });
    } else if (old.status !== d.status || old.paid !== d.paid || !same(old.einvoice, d.einvoice) || old.ewayBillNo !== d.ewayBillNo) {
      updates.push({ kind: d.kind, id: d.id, status: d.status, paid: d.paid, einvoice: d.einvoice, eway_bill_no: d.ewayBillNo });
    }
  }
  const seen = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
  const mvSeen = seen(before.movements);
  const jrSeen = seen(before.journal);
  const paySeen = seen(before.payments);
  const expSeen = seen(before.expenses);
  const audSeen = seen(before.audit);
  const beforeJr = new Map(before.journal.map((j) => [j.id, j]));
  const beforeProducts = new Map(before.products.map((p) => [p.id, p]));
  const beforeParties = new Map(before.parties.map((p) => [p.id, p]));
  const docKind = new Map(after.docs.map((d) => [d.id, d.kind]));

  const seqs: Row[] = [];
  for (const [k, last] of Object.entries(after.business.sequences)) {
    if (before.business.sequences[k] !== last) {
      const [series, fy] = k.split("|");
      seqs.push({ series, fy: Number(fy), last });
    }
  }

  return {
    module: opts.module,
    action: opts.action,
    sequences: seqs,
    products: after.products.filter((p) => !same(beforeProducts.get(p.id), p)).map(productRow),
    parties: after.parties.filter((p) => !same(beforeParties.get(p.id), p)).map((p) => snake(p as unknown as Row)),
    sales_docs: docs.filter((d) => d._kind === "sales").map(({ _kind, ...r }) => (void _kind, r)),
    purchase_docs: docs.filter((d) => d._kind === "purchase").map(({ _kind, ...r }) => (void _kind, r)),
    doc_updates: updates,
    movements: after.movements.filter((m) => !mvSeen.has(m.id)).map((m) => ({ ...snake(m as unknown as Row), expiry: orNull(m.expiry) })),
    journal: after.journal
      .filter((j) => !jrSeen.has(j.id))
      .map((j) => ({ id: j.id, date: j.date, voucher_type: j.voucherType, number: j.number, narration: j.narration, ref_type: j.refType, ref_id: j.refId, lines: j.lines.map((l) => snake(l as unknown as Row)) })),
    cleared: after.journal.filter((j) => jrSeen.has(j.id) && !same(beforeJr.get(j.id)?.cleared ?? {}, j.cleared ?? {})).map((j) => ({ id: j.id, cleared: j.cleared ?? {} })),
    payments: after.payments
      .filter((p) => !paySeen.has(p.id))
      .map((p) => {
        const { allocations, createdAt, ...rest } = p;
        void createdAt;
        return { ...snake(rest as unknown as Row), allocations: allocations.map((a) => ({ doc_id: a.docId, doc_kind: docKind.get(a.docId) ?? (p.direction === "in" ? "sales" : "purchase"), amount: a.amount })) };
      }),
    expenses: after.expenses
      .filter((e) => !expSeen.has(e.id))
      .map((e) => {
        const { attachmentDataUrl, createdAt, ...rest } = e;
        void attachmentDataUrl;
        void createdAt;
        return { ...snake(rest as unknown as Row), attachment_path: opts.attachmentPaths?.[e.id] };
      }),
    audit: after.audit.filter((a) => !audSeen.has(a.id)).map((a) => ({ action: a.action, entity: a.entity, entity_id: a.entityId, detail: a.detail })),
  };
}

// ---------- raw rows -> engine State ----------

export type RawRows = {
  business: Row;
  sequences?: { series: string; fy: number; last: number }[];
  products?: Row[];
  variants?: Row[];
  warehouses?: Row[];
  parties?: Row[];
  accounts?: Row[];
  movements?: Row[];
  salesDocs?: Row[];
  salesItems?: Row[];
  purchaseDocs?: Row[];
  purchaseItems?: Row[];
  journal?: Row[];
  lines?: Row[];
  payments?: Row[];
  allocations?: Row[];
  expenses?: Row[];
  audit?: Row[];
  members?: Row[];
};

const group = (rows: Row[] | undefined, key: string) => {
  const m = new Map<string, Row[]>();
  for (const r of rows ?? []) m.set(String(r[key]), [...(m.get(String(r[key])) ?? []), r]);
  return m;
};

/** Builds the in-memory State the accounting engine runs on from database rows. */
export function stateFromRows(raw: RawRows): State {
  const variants = group(raw.variants, "product_id");
  const sItems = group(raw.salesItems, "document_id");
  const pItems = group(raw.purchaseItems, "document_id");
  const lines = group(raw.lines, "entry_id");
  const allocs = group(raw.allocations, "payment_id");
  return {
    business: businessFromRow(raw.business, raw.sequences),
    products: (raw.products ?? []).map((p) => productFromRow(p, variants.get(String(p.id)) ?? [])),
    warehouses: (raw.warehouses ?? []).map(warehouseFromRow),
    parties: (raw.parties ?? []).map(partyFromRow),
    accounts: (raw.accounts ?? []).map(accountFromRow),
    movements: (raw.movements ?? []).map(movementFromRow),
    docs: [
      ...(raw.salesDocs ?? []).map((d) => docFromRow("sales", d, sItems.get(String(d.id)) ?? [])),
      ...(raw.purchaseDocs ?? []).map((d) => docFromRow("purchase", d, pItems.get(String(d.id)) ?? [])),
    ],
    payments: (raw.payments ?? []).map((p) => paymentFromRow(p, allocs.get(String(p.id)) ?? [])),
    journal: (raw.journal ?? []).map((j) => journalFromRow(j, lines.get(String(j.id)) ?? [])),
    expenses: (raw.expenses ?? []).map((e) => expenseFromRow(e)),
    members: (raw.members ?? []).map(memberFromRow),
    audit: (raw.audit ?? []).map(auditFromRow),
    counters: {},
  };
}
