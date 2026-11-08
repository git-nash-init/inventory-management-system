import type { Metadata } from "next";
import { UsersSettings } from "@/features/settings/settings";

export const metadata: Metadata = { title: "Users and roles" };

export default function Page() {
  return <UsersSettings />;
}
