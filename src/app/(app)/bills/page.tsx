import type { Metadata } from "next";
import { BillsList } from "@/features/bills/bills-list";

export const metadata: Metadata = { title: "All bills" };

export default function Page() {
  return <BillsList />;
}
