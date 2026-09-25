// REGLE-01 / spec "Dates in French": a date is always picked from two lists (month in
// words, year) and shown as "septembre 2026" — never with a day.
export const FRENCH_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

// "YYYY-MM" or "YYYY-MM-DD" -> "septembre 2026".
export function formatFrenchMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${FRENCH_MONTHS[Number(month) - 1]} ${year}`;
}

// Maintenance guidance is scheduled by calendar month in France (Europe/Paris), same
// timezone reasoning as obligations.ts's getTodayInFrance.
export function getCurrentMonthInFrance(): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "numeric" }).format(new Date()));
}

// "YYYY-MM" for the current month in France — the key maintenance completions are
// recorded and looked up under.
export function currentMonthKey(): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-");
  return `${year}-${month}`;
}

// A past date (last service, manufacture...): from 30 years ago to the current month.
export function pastYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 31 }, (_, i) => currentYear - i);
}

// A future or unbounded date (an expiry, a vehicle's first registration): a wider
// window either side of today.
export function wideYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 41 }, (_, i) => currentYear + 10 - i);
}
