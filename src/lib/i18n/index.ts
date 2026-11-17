"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { translate, unitLabel, type Key, type Lang, type Vars } from "./dictionary";

export { UNITS, type Key, type Lang } from "./dictionary";

const STORAGE_KEY = "shop:lang";
const EVENT = "shop:lang-change";
/** What a new visitor sees before pressing the language button. */
const DEFAULT_LANG: Lang = "hi";

function read(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "hi" ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
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

/** The chosen language (English or Hinglish), remembered on this device, plus t() to translate. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice lasts until the page is reloaded */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => setLang(read() === "hi" ? "en" : "hi"), [setLang]);
  const t = useCallback((key: Key, vars?: Vars) => translate(lang, key, vars), [lang]);
  const unit = useCallback((u: string) => unitLabel(lang, u), [lang]);

  return useMemo(() => ({ lang, setLang, toggle, t, unit }), [lang, setLang, toggle, t, unit]);
}

/** Keeps <html lang> in step with the chosen language. Rendered once in the providers. */
export function LanguageHtmlSync() {
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi-Latn" : "en-IN";
  }, [lang]);
  return null;
}
