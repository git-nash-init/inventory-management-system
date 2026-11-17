import type { Metadata } from "next";
import { BillView } from "@/features/bills/bill-view";

export const metadata: Metadata = { title: "Bill" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillView id={id} />;
}
