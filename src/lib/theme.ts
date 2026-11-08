"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "ims:theme";
const EVENT = "ims:theme-change";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked */
    }
    apply(t);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { theme, setTheme };
}

/** Applies the saved theme once on load. Called from a layout effect in the providers. */
export function applySavedTheme() {
  apply(read());
}
