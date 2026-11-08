import type { Metadata } from "next";
import { AccountsPage } from "@/features/accounting/accounts-page";

export const metadata: Metadata = { title: "Chart of accounts" };

export default function Page() {
  return <AccountsPage />;
}
