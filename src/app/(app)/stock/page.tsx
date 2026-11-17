import type { Metadata } from "next";
import { StockPage } from "@/features/stock/stock-page";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return <StockPage />;
}
