import type { Metadata } from "next";
import { BillForm } from "@/features/bills/bill-form";

export const metadata: Metadata = { title: "Make bill" };

export default function Page() {
  return <BillForm />;
}
