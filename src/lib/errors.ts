import { NotConfiguredError } from "@/lib/supabase/client";
import type { Key, Vars } from "@/lib/i18n/dictionary";

type T = (key: Key, vars?: Vars) => string;

const EXACT: Record<string, Key> = {
  "Add at least one item": "err.noItems",
  "Quantity must be more than 0": "err.qtyMore0",
  "Enter a price": "err.enterPrice",
  "Enter a quantity": "err.enterQty",
  "GST must be between 0 and 100": "err.gstRange",
  "Product not found": "err.productNotFound",
  "Bill not found or already cancelled": "err.billNotFound",
};

/** Turns a database or network error into a short sentence in the chosen language. */
export function friendlyError(error: unknown, t: T, unit: (u: string) => string = (u) => u): string {
  if (error instanceof NotConfiguredError) return t("err.notConfigured");
  const e = error as { message?: string; code?: string } | null;
  const message = (e && typeof e.message === "string" ? e.message : "").trim();

  if (typeof navigator !== "undefined" && !navigator.onLine) return t("err.network");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return t("err.network");

  if (e?.code === "23505" || /products_name_active_uq/.test(message)) return t("err.productExists");

  if (message in EXACT) return t(EXACT[message]);

  const left = message.match(/^Only (\S+) (\S+) of (.+) left$/);
  if (left) return t("err.onlyLeft", { qty: left[1], unit: unit(left[2]), name: left[3] });

  const inStock = message.match(/^Only (\S+) (\S+) in stock, so that much cannot be removed$/);
  if (inStock) return t("err.onlyInStock", { qty: inStock[1], unit: unit(inStock[2]) });

  return t("err.generic");
}
