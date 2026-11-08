import type { Metadata } from "next";
import { TaxSettings } from "@/features/settings/settings";

export const metadata: Metadata = { title: "Tax settings" };

export default function Page() {
  return <TaxSettings />;
}
