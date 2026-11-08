import type { Metadata } from "next";
import { AdjustmentsPage } from "@/features/inventory/adjustments-page";

export const metadata: Metadata = { title: "Adjustments" };

export default function Page() {
  return <AdjustmentsPage />;
}
