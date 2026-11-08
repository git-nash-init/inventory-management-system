import type { Metadata } from "next";
import { LabelsPage } from "@/features/inventory/labels-page";

export const metadata: Metadata = { title: "Barcode labels" };

export default function Page() {
  return <LabelsPage />;
}
