"use client";

import { Moon, Sun, Translate } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const BUTTON = "flex h-10 items-center justify-center gap-1.5 rounded border border-line text-ink hover:bg-surface-2";

/** Switches every word between Hinglish and English. Always placed directly before the light/dark button. */
export function LanguageButton() {
  const { t, lang, toggle } = useI18n();
  const label = lang === "hi" ? t("top.langToEnglish") : t("top.langToHinglish");
  return (
    <button onClick={toggle} aria-label={label} title={label} className={`${BUTTON} px-2.5 text-sm font-medium`}>
      <Translate size={18} />
      <span className="num">{lang === "hi" ? "HI" : "EN"}</span>
    </button>
  );
}

export function ThemeButton() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? t("top.themeToLight") : t("top.themeToDark");
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={label} title={label} className={`${BUTTON} w-10 text-muted hover:text-ink`}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
