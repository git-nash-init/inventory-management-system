import type { Metadata } from "next";
import { TransfersPage } from "@/features/inventory/transfers-page";

export const metadata: Metadata = { title: "Transfers" };

export default function Page() {
  return <TransfersPage />;
}
