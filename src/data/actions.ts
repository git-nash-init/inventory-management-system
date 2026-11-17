"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import type { Shop } from "./types";

export type NewProduct = {
  name: string;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  lowStockAt: number | null;
  openingQty: number;
};

export type ProductChanges = Omit<NewProduct, "openingQty">;

export type NewBill = {
  customerName: string;
  customerMobile: string;
  gstPercent: number | null;
  items: { productId: string; qty: number; price: number }[];
};

export async function addProduct(p: NewProduct): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("products")
    .insert({ name: p.name.trim(), unit: p.unit, buy_price: p.buyPrice, sell_price: p.sellPrice, low_stock_at: p.lowStockAt })
    .select("id")
    .single();
  if (error) throw error;
  if (p.openingQty > 0) {
    const r = await sb.rpc("add_stock", { p_product: data.id, p_qty: p.openingQty, p_buy_price: p.buyPrice, p_note: "Opening stock" });
    if (r.error) throw r.error;
  }
}

export async function updateProduct(id: string, p: ProductChanges): Promise<void> {
  const { error } = await getSupabase()
    .from("products")
    .update({ name: p.name.trim(), unit: p.unit, buy_price: p.buyPrice, sell_price: p.sellPrice, low_stock_at: p.lowStockAt })
    .eq("id", id);
  if (error) throw error;
}

/** The product leaves the lists. Old bills keep their own copy of the name and price. */
export async function removeProduct(id: string): Promise<void> {
  const { error } = await getSupabase().from("products").update({ active: false }).eq("id", id);
  if (error) throw error;
}

/** qty > 0 adds stock (with the buying price). qty < 0 is a correction. */
export async function addStock(productId: string, qty: number, buyPrice: number | null, note: string): Promise<void> {
  const { error } = await getSupabase().rpc("add_stock", {
    p_product: productId,
    p_qty: qty,
    ...(buyPrice === null ? {} : { p_buy_price: buyPrice }),
    p_note: note,
  });
  if (error) throw error;
}

/** Returns the id of the new bill. The database refuses it if there is not enough stock. */
export async function createBill(b: NewBill): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_invoice", {
    p_customer_name: b.customerName,
    p_customer_mobile: b.customerMobile,
    p_gst_percent: b.gstPercent ?? 0,
    p_items: b.items.map((i) => ({ product_id: i.productId, qty: i.qty, price: i.price })),
  });
  if (error) throw error;
  return data;
}

export async function cancelBill(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("cancel_invoice", { p_id: id });
  if (error) throw error;
}

export async function saveShop(s: Shop): Promise<void> {
  const { error } = await getSupabase()
    .from("shop")
    .update({
      name: s.name.trim(),
      address: s.address.trim(),
      phone: s.phone.trim(),
      bank_name: s.bankName.trim(),
      account_no: s.accountNo.trim(),
      ifsc: s.ifsc.trim().toUpperCase(),
      upi_id: s.upiId.trim(),
    })
    .eq("id", 1);
  if (error) throw error;
}

/**
 * Runs an action, then refreshes every list on screen. Errors are shown as a short sentence in the
 * chosen language (never a raw database message).
 */
export function useAction<TInput, TResult = void>(
  fn: (input: TInput) => Promise<TResult>,
  opts: { success?: string; onDone?: (result: TResult) => void } = {},
) {
  const qc = useQueryClient();
  const { t, unit } = useI18n();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries();
      if (opts.success) toast.success(opts.success);
      opts.onDone?.(result);
    },
    onError: (e) => {
      toast.error(friendlyError(e, t, unit));
    },
  });
}
