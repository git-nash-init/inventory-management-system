"use client";

import { useEffect, useRef } from "react";
import { saveDraft } from "@/lib/drafts";

/** Debounced autosave of form values to IndexedDB. */
export function useAutosaveDraft<T>(key: string, values: T, enabled = true, delayMs = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveDraft(key, values);
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, enabled, delayMs]);
}
