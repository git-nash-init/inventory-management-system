import { z } from "zod";
import { validateGstin, PAN_REGEX } from "@/lib/gst/gstin";

const num = (label: string) => z.number({ error: `Enter ${label} as a number` });
const money = (label: string) => num(label).min(0, `${label[0].toUpperCase()}${label.slice(1)} cannot be negative`);

export const gstinField = z
  .string()
  .trim()
  .refine((v) => v === "" || validateGstin(v).valid, { message: "GSTIN must be 15 characters like 27ABCDE1234F1Z5" });

export const UNITS = ["PCS", "KG", "GM", "LTR", "ML", "MTR", "BOX", "BAG", "PKT", "STRIP", "SET", "DOZ", "NOS", "HRS"] as const;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name of at least 2 characters"),
  sku: z.string().trim().max(40, "SKU can be at most 40 characters"),
  barcode: z.string().trim().max(48, "Barcode can be at most 48 characters").regex(/^[\x20-\x7E]*$/, "Barcode can use letters, numbers and symbols only"),
  hsn: z.string().trim().regex(/^([0-9]{4}|[0-9]{6}|[0-9]{8})?$/, "HSN or SAC must be 4, 6 or 8 digits like 8517"),
  isService: z.boolean(),
  gstRate: z.number({ error: "Choose a GST rate" }).refine((v) => [0, 0.25, 3, 5, 12, 18, 28].includes(v), "Choose 0, 5, 12, 18 or 28 percent"),
  cessPct: money("cess").max(100, "Cess cannot be more than 100"),
  unit: z.string().trim().min(1, "Choose a unit"),
  altUnit: z.string().trim().optional(),
  altFactor: z.number().optional(),
  mrp: money("MRP"),
  salePrice: money("sale price"),
  wholesalePrice: money("wholesale price"),
  purchasePrice: money("purchase price"),
  openingStock: money("opening stock"),
  reorderLevel: money("reorder level"),
  category: z.string().trim().max(60),
  brand: z.string().trim().max(60),
  trackBatch: z.boolean(),
  trackSerial: z.boolean(),
  variantsText: z.string().trim().max(300),
  active: z.boolean(),
});
export type ProductForm = z.infer<typeof productSchema>;

export const partySchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name of at least 2 characters"),
    gstin: gstinField,
    stateCode: z.string().regex(/^[0-9]{2}$/, "Choose a state"),
    phone: z.string().trim().regex(/^([6-9][0-9]{9})?$/, "Phone must be a 10 digit Indian mobile number"),
    email: z.string().trim().regex(/^([^@\s]+@[^@\s]+\.[^@\s]+)?$/, "Email must look like name@example.com"),
    address: z.string().trim().max(300),
    creditLimit: money("credit limit"),
    creditDays: num("credit days").int("Credit days must be a whole number").min(0, "Credit days cannot be negative").max(365, "Credit days cannot be more than 365"),
    openingBalance: num("opening balance"),
    priceList: z.enum(["retail", "wholesale"]),
    active: z.boolean(),
  })
  .refine((d) => !d.gstin || d.gstin.slice(0, 2) === d.stateCode, {
    path: ["stateCode"],
    message: "State does not match the first two digits of the GSTIN",
  });
export type PartyForm = z.infer<typeof partySchema>;

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, "Enter a warehouse name"),
  address: z.string().trim().max(300),
  isDefault: z.boolean(),
});
export type WarehouseForm = z.infer<typeof warehouseSchema>;

export const adjustSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  productId: z.string().min(1, "Choose a product"),
  warehouseId: z.string().min(1, "Choose a warehouse"),
  direction: z.enum(["remove", "add"]),
  qty: num("quantity").gt(0, "Quantity must be more than 0"),
  reason: z.enum(["damage", "loss", "audit", "found", "expired", "other"]),
  batchNo: z.string().trim().max(40),
  expiry: z.string(),
  note: z.string().trim().max(200),
});
export type AdjustForm = z.infer<typeof adjustSchema>;

export const transferSchema = z
  .object({
    date: z.string().min(1, "Choose a date"),
    productId: z.string().min(1, "Choose a product"),
    fromWarehouseId: z.string().min(1, "Choose the source warehouse"),
    toWarehouseId: z.string().min(1, "Choose the destination warehouse"),
    qty: num("quantity").gt(0, "Quantity must be more than 0"),
    note: z.string().trim().max(200),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, { path: ["toWarehouseId"], message: "Choose a different warehouse from the source" });
export type TransferForm = z.infer<typeof transferSchema>;

export const paymentSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  partyId: z.string().min(1, "Choose a party"),
  amount: num("the amount").gt(0, "Amount must be more than 0"),
  mode: z.enum(["cash", "upi", "bank", "cheque"]),
  accountId: z.string().min(1, "Choose where the money went"),
  reference: z.string().trim().max(60),
  notes: z.string().trim().max(200),
});
export type PaymentForm = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  category: z.string().min(1, "Choose a category"),
  amount: num("the amount").gt(0, "Amount must be more than 0"),
  gstAmount: money("GST amount"),
  payFromAccountId: z.string().min(1, "Choose cash or a bank account"),
  vendor: z.string().trim().max(100),
  notes: z.string().trim().max(200),
});
export type ExpenseForm = z.infer<typeof expenseSchema>;

export const accountSchema = z.object({
  code: z.string().trim().regex(/^[0-9]{3,6}$/, "Code must be 3 to 6 digits"),
  name: z.string().trim().min(2, "Enter an account name"),
  group: z.string().min(1, "Choose a group"),
});
export type AccountForm = z.infer<typeof accountSchema>;

export const inviteSchema = z.object({
  email: z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email must look like name@example.com"),
  name: z.string().trim().max(80),
  role: z.enum(["owner", "manager", "accountant", "sales", "storekeeper"]),
});
export type InviteForm = z.infer<typeof inviteSchema>;

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name"),
  legalName: z.string().trim().max(120),
  gstin: gstinField,
  pan: z.string().trim().toUpperCase().regex(/^([A-Z]{5}[0-9]{4}[A-Z])?$/, "PAN must be 10 characters like ABCDE1234F"),
  stateCode: z.string().regex(/^[0-9]{2}$/, "Choose a state"),
  address: z.string().trim().max(300),
  city: z.string().trim().max(60),
  pincode: z.string().trim().regex(/^([1-9][0-9]{5})?$/, "PIN code must be 6 digits"),
  phone: z.string().trim().regex(/^([6-9][0-9]{9})?$/, "Phone must be a 10 digit Indian mobile number"),
  email: z.string().trim().regex(/^([^@\s]+@[^@\s]+\.[^@\s]+)?$/, "Email must look like name@example.com"),
  bankName: z.string().trim().max(80),
  bankAccount: z.string().trim().regex(/^([0-9]{6,18})?$/, "Account number must be 6 to 18 digits"),
  ifsc: z.string().trim().toUpperCase().regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "IFSC must be 11 characters like SBIN0000300"),
  upiId: z.string().trim().regex(/^([\w.\-]{2,}@[A-Za-z]{2,})?$/, "UPI ID must look like name@bank"),
});
export type BusinessForm = z.infer<typeof businessSchema>;

export { PAN_REGEX };
