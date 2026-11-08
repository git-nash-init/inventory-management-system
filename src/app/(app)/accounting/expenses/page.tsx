import { Suspense } from "react";
import type { Metadata } from "next";
import { ExpensesPage } from "@/features/accounting/expenses-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExpensesPage />
    </Suspense>
  );
}
