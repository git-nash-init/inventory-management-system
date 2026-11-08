import type { Metadata } from "next";
import { PosPage } from "@/features/documents/pos-page";

export const metadata: Metadata = { title: "Quick bill" };

export default function Page() {
  return <PosPage />;
}
