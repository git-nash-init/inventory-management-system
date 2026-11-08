import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductsPage } from "@/features/inventory/products-page";
import { PageSkeleton } from "@/components/states/skeletons";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsPage />
    </Suspense>
  );
}
