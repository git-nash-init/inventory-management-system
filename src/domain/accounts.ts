import type { Account } from "./types";

/** Stable ids for system accounts. Auto-posting rules refer to these. */
export const SYS = {
  capital: "acc-capital",
  reserves: "acc-reserves",
  cash: "acc-cash",
  bank: "acc-bank",
  stock: "acc-stock",
  debtors: "acc-debtors",
  creditors: "acc-creditors",
  inCgst: "acc-in-cgst",
  inSgst: "acc-in-sgst",
  inIgst: "acc-in-igst",
  inCess: "acc-in-cess",
  outCgst: "acc-out-cgst",
  outSgst: "acc-out-sgst",
  outIgst: "acc-out-igst",
  outCess: "acc-out-cess",
  tcs: "acc-tcs",
  loan: "acc-loan",
  sales: "acc-sales",
  salesReturn: "acc-sales-return",
  otherIncome: "acc-other-income",
  stockGain: "acc-stock-gain",
  cogs: "acc-cogs",
  directExp: "acc-direct-exp",
  stockLoss: "acc-stock-loss",
  roundOff: "acc-roundoff",
} as const;

const a = (
  id: string,
  code: string,
  name: string,
  group: Account["group"],
  nature: Account["nature"],
): Account => ({ id, code, name, group, nature, system: true });

export function defaultAccounts(): Account[] {
  return [
    a(SYS.capital, "1000", "Capital Account", "Capital Account", "capital"),
    a(SYS.reserves, "1100", "Reserves and Surplus", "Reserves and Surplus", "capital"),
    a(SYS.cash, "2000", "Cash in Hand", "Cash in Hand", "asset"),
    a(SYS.bank, "2010", "Main Bank Account", "Bank Accounts", "asset"),
    a(SYS.stock, "2100", "Stock in Hand", "Stock in Hand", "asset"),
    a(SYS.debtors, "2200", "Sundry Debtors", "Sundry Debtors", "asset"),
    a(SYS.inCgst, "2300", "Input CGST", "Duties and Taxes", "asset"),
    a(SYS.inSgst, "2301", "Input SGST", "Duties and Taxes", "asset"),
    a(SYS.inIgst, "2302", "Input IGST", "Duties and Taxes", "asset"),
    a(SYS.inCess, "2303", "Input Cess", "Duties and Taxes", "asset"),
    a(SYS.creditors, "3000", "Sundry Creditors", "Sundry Creditors", "liability"),
    a(SYS.outCgst, "3100", "Output CGST", "Duties and Taxes", "liability"),
    a(SYS.outSgst, "3101", "Output SGST", "Duties and Taxes", "liability"),
    a(SYS.outIgst, "3102", "Output IGST", "Duties and Taxes", "liability"),
    a(SYS.outCess, "3103", "Output Cess", "Duties and Taxes", "liability"),
    a(SYS.tcs, "3110", "TCS Payable", "Duties and Taxes", "liability"),
    a(SYS.loan, "3200", "Loans", "Loans", "liability"),
    a(SYS.sales, "4000", "Sales", "Sales Accounts", "income"),
    a(SYS.salesReturn, "4010", "Sales Returns", "Sales Accounts", "income"),
    a(SYS.otherIncome, "4100", "Other Income", "Indirect Income", "income"),
    a(SYS.stockGain, "4110", "Stock Gain", "Indirect Income", "income"),
    a(SYS.cogs, "5000", "Cost of Goods Sold", "Direct Expenses", "expense"),
    a(SYS.directExp, "5100", "Direct Expenses", "Direct Expenses", "expense"),
    a("acc-rent", "5200", "Rent", "Indirect Expenses", "expense"),
    a("acc-salary", "5210", "Salaries and Wages", "Indirect Expenses", "expense"),
    a("acc-electric", "5220", "Electricity", "Indirect Expenses", "expense"),
    a("acc-transport", "5230", "Transport and Freight", "Indirect Expenses", "expense"),
    a("acc-office", "5240", "Office Expenses", "Indirect Expenses", "expense"),
    a("acc-misc", "5290", "Miscellaneous Expenses", "Indirect Expenses", "expense"),
    a(SYS.stockLoss, "5300", "Stock Loss and Damage", "Indirect Expenses", "expense"),
    a(SYS.roundOff, "5900", "Round Off", "Indirect Expenses", "expense"),
  ];
}

export const EXPENSE_CATEGORIES: { label: string; accountId: string }[] = [
  { label: "Rent", accountId: "acc-rent" },
  { label: "Salaries and wages", accountId: "acc-salary" },
  { label: "Electricity", accountId: "acc-electric" },
  { label: "Transport and freight", accountId: "acc-transport" },
  { label: "Office expenses", accountId: "acc-office" },
  { label: "Miscellaneous", accountId: "acc-misc" },
];

/** Debit-normal natures. */
export const isDebitNature = (n: Account["nature"]) => n === "asset" || n === "expense";
