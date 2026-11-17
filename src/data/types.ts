export type Product = {
  id: string;
  name: string;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  lowStockAt: number | null;
  /** How much is left in the shop right now. */
  quantity: number;
  /** quantity x buyPrice */
  stockValue: number;
};

export type Shop = {
  name: string;
  address: string;
  phone: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
};

export type BillStatus = "active" | "cancelled";

export type BillRow = {
  id: string;
  number: number;
  date: string;
  customerName: string;
  customerMobile: string;
  gstPercent: number | null;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: BillStatus;
};

export type BillItem = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
};

export type Bill = BillRow & { items: BillItem[] };

export type SoldItem = { name: string; unit: string; qty: number; amount: number };

export type Dashboard = {
  sold: number;
  gstCollected: number;
  bills: number;
  bought: number;
  costOfSold: number;
  profit: number;
  stockValue: number;
  soldItems: SoldItem[];
};
