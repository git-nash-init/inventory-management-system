import { Suspense } from "react";
import type { Metadata } from "next";
import { NewDoc } from "@/features/documents/new-doc";
import { routeFor } from "@/features/documents/config";
import { PageSkeleton } from "@/components/states/skeletons";

const route = routeFor("sales", "orders")!;
export const metadata: Metadata = { title: `New ${route.singular}` };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewDoc route={route} />
    </Suspense>
  );
}
