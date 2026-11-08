"use client";

import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/context";
import { FyProvider } from "@/lib/fy";
import { LiteModeProvider } from "@/components/states/lite-mode";
import { applySavedTheme } from "@/lib/theme";
import { isDemo } from "@/lib/env";

const DAY = 24 * 60 * 60 * 1000;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Cache survives reloads so the last data stays visible offline (state 4).
          queries: { gcTime: DAY, staleTime: 5_000, refetchOnWindowFocus: false, networkMode: "offlineFirst" },
          mutations: { networkMode: "online" },
        },
      }),
  );
  const [persister] = React.useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: isDemo ? "ims-query-demo" : "ims-query",
      throttleTime: 1000,
    }),
  );

  React.useEffect(() => {
    applySavedTheme();
  }, []);

  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: DAY, buster: "v1" }}>
      <LiteModeProvider>
        <AuthProvider>
          <FyProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "3px",
                  boxShadow: "none",
                  fontFamily: "var(--font-sans)",
                },
              }}
            />
          </FyProvider>
        </AuthProvider>
      </LiteModeProvider>
    </PersistQueryClientProvider>
  );
}
