import type { Metadata } from "next";
import { DocDetail } from "@/features/documents/doc-detail";

export const metadata: Metadata = { title: "Document" };

export default function Page() {
  return <DocDetail />;
}
