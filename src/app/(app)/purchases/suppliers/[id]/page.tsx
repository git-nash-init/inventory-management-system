import type { Metadata } from "next";
import { PartyDetail } from "@/features/parties/party-detail";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page() {
  return <PartyDetail type="supplier" />;
}
