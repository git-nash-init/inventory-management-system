"use client";

import Link from "next/link";
import { Moon, Sun, Translate } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useShop } from "@/data/queries";

export function Topbar() {
  const { t, lang, toggle } = useI18n();
  const { theme, setTheme } = useTheme();
  const shop = useShop();
  const title = shop.data?.name || t("app.name");

  return (
    <header className="no-print flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-6">
      <Link href="/dashboard" className="min-w-0 truncate text-base font-semibold">
        {title}
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* Language button sits directly before the light/dark button. */}
        <button
          onClick={toggle}
          aria-label={lang === "hi" ? t("top.langToEnglish") : t("top.langToHinglish")}
          title={lang === "hi" ? t("top.langToEnglish") : t("top.langToHinglish")}
          className="flex h-9 items-center gap-1.5 rounded border border-line px-2.5 text-sm font-medium text-ink hover:bg-surface-2"
        >
          <Translate size={18} />
          <span className="num">{lang === "hi" ? "HI" : "EN"}</span>
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? t("top.themeToLight") : t("top.themeToDark")}
          title={theme === "dark" ? t("top.themeToLight") : t("top.themeToDark")}
          className="flex h-9 w-9 items-center justify-center rounded border border-line text-muted hover:bg-surface-2 hover:text-ink"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
