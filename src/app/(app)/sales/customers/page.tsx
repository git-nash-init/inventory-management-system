import { Suspense } from "react";
import type { Metadata } from "next";
import { PartiesPage } from "@/features/parties/parties-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PartiesPage type="customer" />
    </Suspense>
  );
}
