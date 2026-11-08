import { Suspense } from "react";
import type { Metadata } from "next";
import { ReportsPage } from "@/features/accounting/reports-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsPage />
    </Suspense>
  );
}
