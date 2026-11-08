import type { Module } from "@/domain/permissions";

export type NavLeaf = { label: string; href: string };
export type NavGroup = { label: string; href: string; module: Module; icon: string; children?: NavLeaf[] };

export const NAV: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard", module: "dashboard", icon: "house" },
  {
    label: "Inventory", href: "/inventory/products", module: "inventory", icon: "package",
    children: [
      { label: "Products", href: "/inventory/products" },
      { label: "Stock", href: "/inventory/stock" },
      { label: "Warehouses", href: "/inventory/warehouses" },
      { label: "Adjustments", href: "/inventory/adjustments" },
      { label: "Transfers", href: "/inventory/transfers" },
    ],
  },
  {
    label: "Sales", href: "/sales/invoices", module: "sales", icon: "receipt",
    children: [
      { label: "Invoices", href: "/sales/invoices" },
      { label: "Quick bill (POS)", href: "/sales/pos" },
      { label: "Quotations", href: "/sales/quotations" },
      { label: "Orders", href: "/sales/orders" },
      { label: "Delivery challans", href: "/sales/challans" },
      { label: "Returns", href: "/sales/returns" },
      { label: "Customers", href: "/sales/customers" },
      { label: "Payments received", href: "/sales/payments" },
    ],
  },
  {
    label: "Purchases", href: "/purchases/bills", module: "purchases", icon: "cart",
    children: [
      { label: "Bills", href: "/purchases/bills" },
      { label: "Purchase orders", href: "/purchases/orders" },
      { label: "Goods received", href: "/purchases/grn" },
      { label: "Returns", href: "/purchases/returns" },
      { label: "Suppliers", href: "/purchases/suppliers" },
      { label: "Payments made", href: "/purchases/payments" },
    ],
  },
  {
    label: "Accounting", href: "/accounting/accounts", module: "accounting", icon: "book",
    children: [
      { label: "Chart of accounts", href: "/accounting/accounts" },
      { label: "Vouchers", href: "/accounting/vouchers" },
      { label: "Expenses", href: "/accounting/expenses" },
      { label: "Cash book", href: "/accounting/cash-book" },
      { label: "Bank book", href: "/accounting/bank-book" },
      { label: "Day book", href: "/accounting/day-book" },
      { label: "Reports", href: "/accounting/reports" },
    ],
  },
  {
    label: "Settings", href: "/settings/business", module: "settings", icon: "gear",
    children: [
      { label: "Business", href: "/settings/business" },
      { label: "Invoice", href: "/settings/invoice" },
      { label: "Taxes", href: "/settings/taxes" },
      { label: "Users and roles", href: "/settings/users" },
      { label: "Activity log", href: "/settings/activity" },
    ],
  },
];

export const PAGE_ACTIONS: { label: string; href: string; keywords: string }[] = [
  { label: "New sales invoice", href: "/sales/invoices/new", keywords: "create bill invoice sale" },
  { label: "New purchase bill", href: "/purchases/bills/new", keywords: "create bill purchase supplier" },
  { label: "New product", href: "/inventory/products?new=1", keywords: "add item product sku" },
  { label: "New customer", href: "/sales/customers?new=1", keywords: "add party customer" },
  { label: "New supplier", href: "/purchases/suppliers?new=1", keywords: "add party supplier vendor" },
  { label: "Record payment received", href: "/sales/payments?new=1", keywords: "receipt collect" },
  { label: "Add expense", href: "/accounting/expenses?new=1", keywords: "spend cost" },
  { label: "Quick bill (POS)", href: "/sales/pos", keywords: "counter barcode scan" },
];
