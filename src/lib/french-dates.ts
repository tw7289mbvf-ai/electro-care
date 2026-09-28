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

// "YYYY-MM" shifted by `delta` calendar months — "Reporter" moves a task's guidance
// forward one month at a time.
export function addMonthsToKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

// Whole calendar months from `a` to `b` ("YYYY-MM" each), b - a.
export function monthsBetweenKeys(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + (bm - 1) - (ay * 12 + (am - 1));
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
