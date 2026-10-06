// Display theme (docs/design.md, "Choix du thème"): kept in a first-party cookie on the
// device, never in the database. Read on the server so <html data-theme> is right from
// the first byte; no cookie means light.
export const THEME_COOKIE = "ec-theme";

export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  light: "Clair",
  dark: "Sombre",
  system: "Selon le téléphone",
};

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "light";
}
