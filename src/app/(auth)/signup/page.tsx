import type { Metadata } from "next";
import { SignupForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return <SignupForm />;
}
