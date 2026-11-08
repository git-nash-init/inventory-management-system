"use client";

import * as React from "react";

type Ctx = { lite: boolean; setLite: (v: boolean) => void };
const LiteCtx = React.createContext<Ctx>({ lite: false, setLite: () => {} });

const KEY = "ims:lite";
const EVENT = "ims:lite-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Lite mode hides charts and images and shrinks page sizes for slow connections. */
export function LiteModeProvider({ children }: { children: React.ReactNode }) {
  const lite = React.useSyncExternalStore(subscribe, read, () => false);

  const setLite = React.useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return <LiteCtx.Provider value={{ lite, setLite }}>{children}</LiteCtx.Provider>;
}

export const useLiteMode = () => React.useContext(LiteCtx);
export const pageSizeFor = (lite: boolean) => (lite ? 10 : 25);
