import type { Metadata } from "next";
import { VouchersPage } from "@/features/accounting/vouchers-page";

export const metadata: Metadata = { title: "Vouchers" };

export default function Page() {
  return <VouchersPage />;
}
