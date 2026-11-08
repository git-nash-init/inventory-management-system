"use client";

import * as React from "react";
import { fyLabel, fyRange, fyStartYear, toISODate } from "@/lib/format/date";

type FyCtx = {
  startYear: number;
  label: string;
  from: string;
  to: string;
  today: string;
  options: number[];
  setStartYear: (y: number) => void;
};

const Ctx = React.createContext<FyCtx | null>(null);
const KEY = "ims:fy";
const EVENT = "ims:fy-change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function FyProvider({ children }: { children: React.ReactNode }) {
  const saved = React.useSyncExternalStore(subscribe, read, () => null);
  const now = new Date();
  const current = fyStartYear(now);
  const startYear = saved && /^\d{4}$/.test(saved) ? Number(saved) : current;
  const range = fyRange(startYear);
  const value = React.useMemo<FyCtx>(
    () => ({
      startYear,
      label: fyLabel(startYear),
      from: toISODate(range.from),
      // Reports for the running FY stop at today; past FYs run to 31 March.
      to: toISODate(range.to),
      today: toISODate(now),
      options: [current, current - 1, current - 2],
      setStartYear: (y: number) => {
        try {
          localStorage.setItem(KEY, String(y));
        } catch {
          /* storage blocked */
        }
        window.dispatchEvent(new Event(EVENT));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startYear, current],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFy() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useFy must be used inside FyProvider");
  return v;
}
