import type { Metadata } from "next";
import { DayBookPage } from "@/features/accounting/daybook-page";

export const metadata: Metadata = { title: "Day book" };

export default function Page() {
  return <DayBookPage />;
}
