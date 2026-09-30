"use client";

import { FRENCH_MONTHS } from "@/lib/french-dates";

const SELECT_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export type MonthYearValue = { month: string; year: string };

export function monthYearToIso(value: MonthYearValue): string | null {
  if (!value.month || !value.year) return null;
  return `${value.year}-${value.month}-01`;
}

// REGLE-01: dates are picked from two lists (month in words, year), never a day.
export function MonthYearFields({
  value,
  onChange,
  years,
  small = false,
  disableFutureMonths = false,
}: {
  value: MonthYearValue;
  onChange: (value: MonthYearValue) => void;
  years: number[];
  small?: boolean;
  // A done intervention is a proof (spec's "Mark a legal obligation as done"): current
  // month or a past one, never a future one. Only meaningful when `years` already stops
  // at the current year — the month list still shows all 12 for a past year.
  disableFutureMonths?: boolean;
}) {
  const className = small ? `${SELECT_CLASS} px-2 py-1 text-xs` : SELECT_CLASS;
  const now = new Date();
  const isCurrentYearSelected = disableFutureMonths && Number(value.year) === now.getFullYear();
  const maxMonth = isCurrentYearSelected ? now.getMonth() + 1 : 12;
  return (
    <div className="flex gap-2">
      <select value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} className={className}>
        <option value="">Mois</option>
        {FRENCH_MONTHS.map((label, i) => (
          <option key={label} value={String(i + 1).padStart(2, "0")} disabled={i + 1 > maxMonth}>
            {label}
          </option>
        ))}
      </select>
      <select value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })} className={className}>
        <option value="">Année</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
