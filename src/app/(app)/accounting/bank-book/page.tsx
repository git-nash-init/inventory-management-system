import type { Metadata } from "next";
import { BooksPage } from "@/features/accounting/books-page";

export const metadata: Metadata = { title: "Bank book" };

export default function Page() {
  return <BooksPage mode="bank" />;
}
