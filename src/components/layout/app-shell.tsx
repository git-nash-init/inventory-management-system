"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, List, Package, Plus, Storefront } from "@phosphor-icons/react";
import { useShop } from "@/data/queries";
import { useI18n, type Key } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LanguageButton, ThemeButton } from "./header-controls";

type NavItem = {
  href: string;
  label: Key;
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill" }>;
  match: (path: string) => boolean;
  primary?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "nav.home", icon: House, match: (p) => p.startsWith("/dashboard") },
  { href: "/stock", label: "nav.stock", icon: Package, match: (p) => p.startsWith("/stock") },
  { href: "/bills/new", label: "nav.newBill", icon: Plus, match: (p) => p === "/bills/new", primary: true },
  { href: "/bills", label: "nav.bills", icon: List, match: (p) => p === "/bills" || (p.startsWith("/bills/") && p !== "/bills/new") },
  { href: "/settings", label: "nav.shop", icon: Storefront, match: (p) => p.startsWith("/settings") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const shop = useShop();
  const title = shop.data?.name || t("app.name");

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>

      {/*
        Large screens: ONE bar with the shop name, the five pages, and the language and light/dark buttons.
        Phones and tablets: a slim bar with the shop name and the two buttons, and the five pages as a tab bar at the bottom.
      */}
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:px-4 md:px-6 lg:h-16 lg:gap-3">
          <Link href="/dashboard" className="flex h-10 min-w-0 items-center text-base font-semibold lg:max-w-[12rem] xl:max-w-[16rem]" title={title}>
            <span className="truncate">{title}</span>
          </Link>

          <nav aria-label={t("nav.menu")} className="ml-2 hidden shrink-0 lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded border px-2.5 text-sm font-medium whitespace-nowrap xl:px-3",
                        item.primary
                          ? "border-accent bg-accent text-accent-ink hover:border-ink hover:bg-ink"
                          : active
                            ? "border-line bg-surface-2 text-ink"
                            : "border-transparent text-muted hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      <span className="hidden xl:block">
                        <Icon size={18} />
                      </span>
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <LanguageButton />
            <ThemeButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl min-w-0 flex-1 p-3 pb-28 sm:p-4 sm:pb-28 md:p-6 md:pb-28 lg:pb-8">
        {children}
      </main>

      <nav aria-label={t("nav.menu")} className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-medium leading-tight sm:text-xs", active ? "text-accent" : "text-muted")}
                >
                  <span
                    className={cn(
                      "flex h-8 w-11 items-center justify-center rounded-full",
                      item.primary ? "bg-accent text-accent-ink" : active ? "bg-surface-2" : "",
                    )}
                  >
                    <Icon size={22} weight={active || item.primary ? "bold" : "regular"} />
                  </span>
                  <span className="line-clamp-2 break-words">{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
