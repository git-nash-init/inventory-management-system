import type { Metadata } from "next";
import { ShopSettings } from "@/features/settings/shop-form";

export const metadata: Metadata = { title: "Shop details" };

export default function Page() {
  return <ShopSettings />;
}
