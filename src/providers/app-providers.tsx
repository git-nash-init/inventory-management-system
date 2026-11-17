"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { LanguageHtmlSync } from "@/lib/i18n";
import { applySavedTheme } from "@/lib/theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        // Several people or devices may use the shop at once, so refresh when the tab is opened again.
        defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );

  React.useEffect(() => {
    applySavedTheme();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <LanguageHtmlSync />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: "3px",
            boxShadow: "none",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
