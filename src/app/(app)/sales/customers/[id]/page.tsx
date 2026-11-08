import type { Metadata } from "next";
import { PartyDetail } from "@/features/parties/party-detail";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return <PartyDetail type="customer" />;
}
