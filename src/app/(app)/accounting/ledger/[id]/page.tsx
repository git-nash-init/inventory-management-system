import type { Metadata } from "next";
import { BooksPage } from "@/features/accounting/books-page";

export const metadata: Metadata = { title: "Ledger" };

export default function Page() {
  return <BooksPage mode="ledger" />;
}
