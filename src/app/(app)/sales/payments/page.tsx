import { Suspense } from "react";
import type { Metadata } from "next";
import { PaymentsPage } from "@/features/payments/payments-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Payments received" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentsPage direction="in" />
    </Suspense>
  );
}
