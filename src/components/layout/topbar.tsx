"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Buildings, List, Moon, SignOut, Sun, UserCircle } from "@phosphor-icons/react";
import { NativeSelect } from "@/components/ui/input";
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { useTheme } from "@/lib/theme";
import { ROLE_LABEL, ROLES } from "@/domain/permissions";
import { fyLabel } from "@/lib/format/date";
import { CommandPaletteTrigger } from "./command-palette";

export function Topbar({ businessName, onMenu, onSearch }: { businessName: string; onMenu: () => void; onSearch: () => void }) {
  const { user, role, demo, signOut, switchDemoRole } = useAuth();
  const fy = useFy();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  async function handleSignOut() {
    // Do not leave business data cached on a shared machine.
    qc.clear();
    try {
      localStorage.removeItem("ims-query");
      localStorage.removeItem("ims-query-demo");
    } catch {
      /* storage blocked */
    }
    await signOut();
  }

  return (
    <header className="no-print flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-4">
      <button onClick={onMenu} aria-label="Open menu" className="rounded p-1.5 hover:bg-surface-2 md:hidden">
        <List size={20} />
      </button>
      <CommandPaletteTrigger onOpen={onSearch} />
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <label className="sr-only" htmlFor="fy-select">
          Financial year
        </label>
        <NativeSelect id="fy-select" value={fy.startYear} onChange={(e) => fy.setStartYear(Number(e.target.value))} className="h-8 w-[6.75rem] text-xs sm:w-28">
          {fy.options.map((y) => (
            <option key={y} value={y}>
              FY {fyLabel(y)}
            </option>
          ))}
        </NativeSelect>

        <DropdownMenu>
          <DropdownTrigger className="hidden h-8 items-center gap-1.5 rounded border border-line px-2.5 text-xs hover:bg-surface-2 sm:flex" aria-label="Switch business">
            <Buildings size={14} />
            <span className="max-w-32 truncate">{businessName}</span>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Your businesses</DropdownLabel>
            <DropdownItem>{businessName}</DropdownItem>
            <DropdownSeparator />
            <DropdownItem disabled>Add another business (coming with multi-business billing)</DropdownItem>
          </DropdownContent>
        </DropdownMenu>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <DropdownMenu>
          <DropdownTrigger className="flex h-8 items-center gap-1.5 rounded border border-line px-2 text-xs hover:bg-surface-2" aria-label="Account menu">
            <UserCircle size={18} />
            <span className="hidden max-w-28 truncate sm:inline">{user?.name}</span>
          </DropdownTrigger>
          <DropdownContent className="w-64">
            <DropdownLabel>
              {user?.email}
              <br />
              Role: {ROLE_LABEL[role]}
            </DropdownLabel>
            {demo ? (
              <>
                <DropdownSeparator />
                <DropdownLabel>Demo only: view the app as</DropdownLabel>
                {ROLES.map((r) => (
                  <DropdownItem key={r} onSelect={() => switchDemoRole(r)}>
                    {ROLE_LABEL[r]}
                    {r === role ? " (current)" : ""}
                  </DropdownItem>
                ))}
              </>
            ) : null}
            <DropdownSeparator />
            <DropdownItem onSelect={() => void handleSignOut()}>
              <SignOut size={16} /> Sign out
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
