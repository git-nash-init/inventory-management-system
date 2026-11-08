import { Suspense } from "react";
import type { Metadata } from "next";
import { MfaForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}
