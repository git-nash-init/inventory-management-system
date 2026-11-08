import type { Metadata } from "next";
import { BooksPage } from "@/features/accounting/books-page";

export const metadata: Metadata = { title: "Cash book" };

export default function Page() {
  return <BooksPage mode="cash" />;
}
