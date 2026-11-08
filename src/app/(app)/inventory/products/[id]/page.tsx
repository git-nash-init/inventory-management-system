import type { Metadata } from "next";
import { ProductDetail } from "@/features/inventory/product-detail";

export const metadata: Metadata = { title: "Product" };

export default function Page() {
  return <ProductDetail />;
}
