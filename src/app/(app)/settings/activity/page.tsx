import type { Metadata } from "next";
import { ActivityLog } from "@/features/settings/settings";

export const metadata: Metadata = { title: "Activity log" };

export default function Page() {
  return <ActivityLog />;
}
