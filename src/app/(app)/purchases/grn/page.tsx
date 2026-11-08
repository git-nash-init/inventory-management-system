import type { Metadata } from "next";
import { DocList } from "@/features/documents/doc-list";
import { routeFor } from "@/features/documents/config";

const route = routeFor("purchase", "grn")!;
export const metadata: Metadata = { title: route.title };

export default function Page() {
  return <DocList route={route} />;
}
