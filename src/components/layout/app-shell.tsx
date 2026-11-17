"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, List, Package, Plus, Storefront } from "@phosphor-icons/react";
import { useI18n, type Key } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Topbar } from "./topbar";

const NAV: { href: string; label: Key; icon: React.ComponentType<{ size?: number }>; match: (p: string) => boolean; primary?: boolean }[] = [
  { href: "/dashboard", label: "nav.home", icon: House, match: (p) => p.startsWith("/dashboard") },
  { href: "/stock", label: "nav.stock", icon: Package, match: (p) => p.startsWith("/stock") },
  { href: "/bills/new", label: "nav.newBill", icon: Plus, match: (p) => p === "/bills/new", primary: true },
  { href: "/bills", label: "nav.bills", icon: List, match: (p) => p === "/bills" || (p.startsWith("/bills/") && p !== "/bills/new") },
  { href: "/settings", label: "nav.shop", icon: Storefront, match: (p) => p.startsWith("/settings") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <Topbar />
      <nav aria-label={t("nav.menu")} className="no-print border-b border-line bg-surface">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-1 px-2 py-1.5 md:px-6">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded border px-3 text-sm font-medium whitespace-nowrap",
                    item.primary
                      ? "border-accent bg-accent text-accent-ink hover:bg-ink hover:border-ink"
                      : active
                        ? "border-line bg-surface-2 text-ink"
                        : "border-transparent text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon size={18} />
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main id="main" className="mx-auto w-full max-w-5xl min-w-0 flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
