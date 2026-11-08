import type { Metadata } from "next";
import { WarehousesPage } from "@/features/inventory/warehouses-page";

export const metadata: Metadata = { title: "Warehouses" };

export default function Page() {
  return <WarehousesPage />;
}
