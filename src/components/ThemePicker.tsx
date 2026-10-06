"use client";

import { useState } from "react";
import { THEME_COOKIE, THEMES, THEME_LABELS, type Theme } from "@/lib/theme";

// Paramètres "Affichage" (docs/design.md, "Choix du thème"): three exclusive choices,
// applied at once by setting <html data-theme>, and kept in a first-party cookie on
// this device only (no database write) so the server renders the right theme next time.
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // the longest browsers keep a cookie

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

export function ThemePicker({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Thème d&apos;affichage</legend>
      {THEMES.map((value) => (
        <label
          key={value}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 text-[15px] text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => choose(value)}
            className="h-4 w-4 accent-accent"
          />
          {THEME_LABELS[value]}
          {value === "light" && <span className="text-sm text-ink-2">(par défaut)</span>}
        </label>
      ))}
    </fieldset>
  );
}
