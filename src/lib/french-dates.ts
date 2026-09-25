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
