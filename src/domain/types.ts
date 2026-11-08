export type Role = "owner" | "manager" | "accountant" | "sales" | "storekeeper";

export type Business = {
  id: string;
  name: string;
  legalName: string;
  gstin: string;
  pan: string;
  stateCode: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  upiId: string;
  taxScheme: "regular" | "composition";
  terms: string;
  invoiceTemplate: "a4" | "a5" | "thermal";
  valuation: "avg" | "fifo";
  tcsPct: number;
  /** Prefix per document type. Number format is PREFIX/FY/0001. */
  prefixes: Record<string, string>;
  /** Next sequence number keyed by `${type}|${fyStartYear}`. */
  sequences: Record<string, number>;
};

export type Variant = { id: string; name: string; sku: string; barcode: string; salePrice?: number };

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  hsn: string;
  isService: boolean;
  gstRate: number;
  cessPct: number;
  unit: string;
  altUnit?: string;
  altFactor?: number;
  mrp: number;
  salePrice: number;
  wholesalePrice: number;
  purchasePrice: number;
  openingStock: number;
  reorderLevel: number;
  category: string;
  brand: string;
  imageUrl?: string;
  trackBatch: boolean;
  trackSerial: boolean;
  variants: Variant[];
  active: boolean;
};

export type Warehouse = { id: string; name: string; address: string; isDefault: boolean };

export type StockMovementType =
  | "opening"
  | "purchase"
  | "sale"
  | "sales_return"
  | "purchase_return"
  | "adjustment"
  | "transfer_out"
  | "transfer_in";

export type StockMovement = {
  id: string;
  date: string; // YYYY-MM-DD
  productId: string;
  variantId?: string;
  warehouseId: string;
  batchNo?: string;
  expiry?: string;
  /** Signed. Positive adds stock. */
  qty: number;
  /** Cost per unit at the time of the movement. */
  rate: number;
  type: StockMovementType;
  refType?: string;
  refId?: string;
  refNumber?: string;
  reason?: string;
};

export type Party = {
  id: string;
  type: "customer" | "supplier";
  name: string;
  gstin: string;
  stateCode: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  creditDays: number;
  /** Positive = they owe us (customer) or we owe them (supplier). */
  openingBalance: number;
  priceList: "retail" | "wholesale";
  active: boolean;
};

export type SalesType =
  | "quotation"
  | "order"
  | "challan"
  | "invoice"
  | "bill_of_supply"
  | "export_invoice"
  | "credit_note";
export type PurchaseType = "order" | "grn" | "bill" | "debit_note";
export type DocKind = "sales" | "purchase";
export type DocType = SalesType | PurchaseType;
export type DocStatus = "draft" | "final" | "converted" | "cancelled";

export type DocItem = {
  productId: string;
  variantId?: string;
  name: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstRate: number;
  cessPct: number;
  batchNo?: string;
  expiry?: string;
  serials?: string[];
  warehouseId?: string;
};

export type Totals = {
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

export type Doc = {
  id: string;
  kind: DocKind;
  type: DocType;
  number: string;
  /** Supplier's own invoice number on a purchase bill. */
  supplierInvoiceNo?: string;
  date: string;
  dueDate?: string;
  partyId?: string;
  partyName: string;
  partyGstin: string;
  placeOfSupply: string;
  supply: "intra" | "inter";
  reverseCharge: boolean;
  items: DocItem[];
  totals: Totals;
  tcsPct: number;
  notes: string;
  terms: string;
  status: DocStatus;
  paid: number;
  refDocId?: string;
  warehouseId: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  einvoice: { irn?: string; ackNo?: string; ackDate?: string; qr?: string };
  ewayBillNo?: string;
  createdAt: string;
  createdBy: string;
};

export type DocInput = Omit<Doc, "id" | "number" | "totals" | "paid" | "createdAt" | "createdBy" | "supply" | "einvoice" | "status"> & {
  status?: DocStatus;
  id?: string;
  /** For walk-in (no party) sales: the cash or bank account the money lands in. Defaults to cash. */
  settleAccountId?: string;
};

export type PaymentMode = "cash" | "upi" | "bank" | "cheque";

export type Payment = {
  id: string;
  number: string;
  direction: "in" | "out";
  date: string;
  partyId: string;
  partyName: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  accountId: string;
  allocations: { docId: string; amount: number }[];
  notes: string;
  createdAt: string;
};

export type PaymentInput = Omit<Payment, "id" | "number" | "createdAt" | "partyName"> & { partyName?: string };

export type AccountGroup =
  | "Capital Account"
  | "Reserves and Surplus"
  | "Current Assets"
  | "Cash in Hand"
  | "Bank Accounts"
  | "Stock in Hand"
  | "Sundry Debtors"
  | "Current Liabilities"
  | "Sundry Creditors"
  | "Duties and Taxes"
  | "Direct Income"
  | "Indirect Income"
  | "Direct Expenses"
  | "Indirect Expenses"
  | "Purchase Accounts"
  | "Sales Accounts"
  | "Loans";

export type AccountNature = "asset" | "liability" | "income" | "expense" | "capital";

export type Account = {
  id: string;
  code: string;
  name: string;
  group: AccountGroup;
  nature: AccountNature;
  system: boolean;
};

export type VoucherType =
  | "sales"
  | "purchase"
  | "receipt"
  | "payment"
  | "contra"
  | "journal"
  | "expense"
  | "stock_adjustment"
  | "credit_note"
  | "debit_note"
  | "opening";

export type JournalLine = { accountId: string; partyId?: string; debit: number; credit: number; narration?: string };

export type JournalEntry = {
  id: string;
  date: string;
  voucherType: VoucherType;
  number: string;
  narration: string;
  refType?: string;
  refId?: string;
  lines: JournalLine[];
  /** Bank reconciliation: accountId -> statement date on which this entry cleared. */
  cleared?: Record<string, string>;
  createdAt: string;
};

export type VoucherInput = {
  date: string;
  voucherType: Extract<VoucherType, "receipt" | "payment" | "contra" | "journal">;
  narration: string;
  lines: JournalLine[];
};

export type Expense = {
  id: string;
  number: string;
  date: string;
  category: string;
  accountId: string;
  payFromAccountId: string;
  amount: number;
  gstAmount: number;
  vendor: string;
  notes: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  createdAt: string;
};

export type ExpenseInput = Omit<Expense, "id" | "number" | "createdAt">;

export type Member = { id: string; email: string; name: string; role: Role; active: boolean; createdAt: string };

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  detail: string;
};

export type AdjustReason = "damage" | "loss" | "audit" | "found" | "expired" | "other";

export type AdjustInput = {
  date: string;
  productId: string;
  variantId?: string;
  warehouseId: string;
  /** Signed. Negative removes stock. */
  qty: number;
  reason: AdjustReason;
  batchNo?: string;
  expiry?: string;
  note: string;
};

export type TransferInput = {
  date: string;
  productId: string;
  variantId?: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
  note: string;
};
