"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Book,
  CaretDown,
  CaretRight,
  Gear,
  House,
  Package,
  Receipt,
  ShoppingCart,
  SidebarSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { NAV, type NavGroup } from "./nav";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  house: House,
  package: Package,
  receipt: Receipt,
  cart: ShoppingCart,
  book: Book,
  gear: Gear,
};

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  businessName,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  businessName: string;
}) {
  const pathname = usePathname();
  const { can } = useAuth();
  const groups = NAV.filter((g) => can(g.module, "view") || (g.module === "accounting" && can("reports", "view")));
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const isActiveGroup = (g: NavGroup) =>
    g.children ? g.children.some((c) => pathname.startsWith(c.href.split("?")[0])) : pathname.startsWith(g.href);

  return (
    <nav aria-label="Main" className="flex h-full flex-col border-r border-line bg-surface">
      <div className={cn("flex h-14 items-center border-b border-line px-3", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? null : (
          <Link href="/dashboard" className="truncate text-sm font-semibold" onClick={onNavigate} title={businessName}>
            {businessName}
          </Link>
        )}
        {onToggle ? (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <SidebarSimple size={18} />
          </button>
        ) : null}
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {groups.map((g) => {
          const Icon = ICONS[g.icon];
          const active = isActiveGroup(g);
          const expanded = open[g.label] ?? active;
          return (
            <li key={g.label} className="mb-0.5">
              {g.children && !collapsed ? (
                <button
                  onClick={() => setOpen((o) => ({ ...o, [g.label]: !expanded }))}
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm hover:bg-surface-2",
                    active ? "font-semibold text-ink" : "text-muted",
                  )}
                >
                  <Icon size={18} />
                  <span className="flex-1">{g.label}</span>
                  {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                </button>
              ) : (
                <Link
                  href={g.href}
                  onClick={onNavigate}
                  title={g.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm hover:bg-surface-2",
                    active ? "bg-surface-2 font-semibold text-ink" : "text-muted",
                    collapsed && "justify-center",
                  )}
                >
                  <Icon size={18} />
                  {collapsed ? <span className="sr-only">{g.label}</span> : <span>{g.label}</span>}
                </Link>
              )}
              {g.children && expanded && !collapsed ? (
                <ul className="ml-4 mt-0.5 border-l border-line pl-2">
                  {g.children
                    .filter((c) => (c.href.startsWith("/settings/users") ? can("users", "view") : true))
                    .map((c) => {
                      const on = pathname === c.href.split("?")[0] || pathname.startsWith(c.href.split("?")[0] + "/");
                      return (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            onClick={onNavigate}
                            aria-current={on ? "page" : undefined}
                            className={cn("block rounded px-2.5 py-1.5 text-sm hover:bg-surface-2", on ? "bg-surface-2 font-medium text-ink" : "text-muted")}
                          >
                            {c.label}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
