import { Suspense } from "react";
import type { Metadata } from "next";
import { PaymentsPage } from "@/features/payments/payments-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Payments made" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentsPage direction="out" />
    </Suspense>
  );
}
