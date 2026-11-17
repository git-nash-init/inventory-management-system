"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Bill, BillRow, BillStatus, Dashboard, Product, Shop, SoldItem } from "./types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type ItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];
type StockRow = Database["public"]["Views"]["product_stock"]["Row"];
type ShopRow = Database["public"]["Tables"]["shop"]["Row"];

export const qk = {
  products: ["products"] as const,
  shop: ["shop"] as const,
  bills: ["bills"] as const,
  bill: (id: string) => ["bill", id] as const,
  dashboard: (month: string) => ["dashboard", month] as const,
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function toProduct(r: StockRow): Product {
  return {
    id: r.id ?? "",
    name: r.name ?? "",
    unit: r.unit ?? "piece",
    buyPrice: num(r.buy_price),
    sellPrice: num(r.sell_price),
    lowStockAt: r.low_stock_at === null || r.low_stock_at === undefined ? null : num(r.low_stock_at),
    quantity: num(r.quantity),
    stockValue: num(r.stock_value),
  };
}

function toShop(r: ShopRow): Shop {
  return { name: r.name, address: r.address, phone: r.phone, bankName: r.bank_name, accountNo: r.account_no, ifsc: r.ifsc, upiId: r.upi_id };
}

function toBillRow(r: InvoiceRow): BillRow {
  return {
    id: r.id,
    number: r.number,
    date: r.invoice_date,
    customerName: r.customer_name,
    customerMobile: r.customer_mobile,
    gstPercent: r.gst_percent === null ? null : num(r.gst_percent),
    subtotal: num(r.subtotal),
    gstAmount: num(r.gst_amount),
    total: num(r.total),
    status: (r.status === "cancelled" ? "cancelled" : "active") as BillStatus,
  };
}

function toDashboard(j: Json): Dashboard {
  const o = (j && typeof j === "object" && !Array.isArray(j) ? j : {}) as Record<string, Json | undefined>;
  const items = Array.isArray(o.sold_items) ? o.sold_items : [];
  const soldItems: SoldItem[] = items.map((x) => {
    const r = (x ?? {}) as Record<string, Json | undefined>;
    return { name: String(r.name ?? ""), unit: String(r.unit ?? ""), qty: num(r.qty), amount: num(r.amount) };
  });
  return {
    sold: num(o.sold),
    gstCollected: num(o.gst_collected),
    bills: num(o.bills),
    bought: num(o.bought),
    costOfSold: num(o.cost_of_sold),
    profit: num(o.profit),
    stockValue: num(o.stock_value),
    soldItems,
  };
}

/** All active products with how much is left. */
export function useProducts() {
  return useQuery({
    queryKey: qk.products,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await getSupabase().from("product_stock").select("*").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []).map(toProduct);
    },
  });
}

export function useShop() {
  return useQuery({
    queryKey: qk.shop,
    queryFn: async (): Promise<Shop> => {
      const { data, error } = await getSupabase().from("shop").select("*").eq("id", 1).single();
      if (error) throw error;
      return toShop(data);
    },
  });
}

/** Newest bills first. The list is searched in the browser, so a few hundred is plenty. */
export function useBills(limit = 300) {
  return useQuery({
    queryKey: [...qk.bills, limit],
    queryFn: async (): Promise<BillRow[]> => {
      const { data, error } = await getSupabase().from("invoices").select("*").order("number", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []).map(toBillRow);
    },
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: qk.bill(id),
    queryFn: async (): Promise<Bill | null> => {
      const sb = getSupabase();
      const head = await sb.from("invoices").select("*").eq("id", id).maybeSingle();
      if (head.error) throw head.error;
      if (!head.data) return null;
      const lines = await sb.from("invoice_items").select("*").eq("invoice_id", id).order("name");
      if (lines.error) throw lines.error;
      return {
        ...toBillRow(head.data),
        items: (lines.data ?? []).map((i: ItemRow) => ({
          id: i.id,
          productId: i.product_id,
          name: i.name,
          unit: i.unit,
          qty: num(i.qty),
          price: num(i.price),
          amount: num(i.amount),
        })),
      };
    },
  });
}

/** `month` is the first day of the month, like 2026-11-01. */
export function useDashboard(month: string) {
  return useQuery({
    queryKey: qk.dashboard(month),
    queryFn: async (): Promise<Dashboard> => {
      const { data, error } = await getSupabase().rpc("dashboard_month", { p_month: month });
      if (error) throw error;
      return toDashboard(data);
    },
  });
}
