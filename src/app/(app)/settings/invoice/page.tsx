import type { Metadata } from "next";
import { InvoiceSettings } from "@/features/settings/settings";

export const metadata: Metadata = { title: "Invoice settings" };

export default function Page() {
  return <InvoiceSettings />;
}
