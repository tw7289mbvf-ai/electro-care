import type { MonthlyActivity } from "@/lib/admin";

// Short French month labels for the chart's x axis.
const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const ACTIVITY_SERIES = [
  { key: "interventions", label: "Interventions obligatoires", className: "bg-series-1" },
  { key: "maintenanceDone", label: "Gestes d'entretien", className: "bg-series-2" },
  { key: "overdueResolved", label: "Retards régularisés", className: "bg-series-3" },
] as const;

export function shortMonthLabel(month: string, withYear = false): string {
  const [year, m] = month.split("-");
  const label = SHORT_MONTHS[Number(m) - 1];
  return withYear ? `${label} ${year}` : label;
}

// "Activité par mois" (spec, "Monthly activity, aggregated"): grouped bars, one group
// per month, three series. Counts only — the data is already aggregated server-side.
// The table below the chart is the accessible view, and the relief for series 3's
// sub-3:1 contrast on the light surface.
export function AdminActivityChart({ activity }: { activity: MonthlyActivity[] }) {
  const max = Math.max(
    1,
    ...activity.flatMap((m) => [m.interventions, m.maintenanceDone, m.overdueResolved ?? 0])
  );

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {ACTIVITY_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.className}`} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="flex h-40 items-end gap-1 border-b border-line-strong" aria-hidden="true">
        {activity.map((m) => (
          <div key={m.month} className="flex h-full flex-1 items-end justify-center gap-[2px]">
            {ACTIVITY_SERIES.map((s) => {
              const value = m[s.key];
              const title = `${shortMonthLabel(m.month, true)} — ${s.label} : ${value ?? "non mesuré"}`;
              return (
                <div key={s.key} title={title} className="flex h-full w-full max-w-3 items-end">
                  {value !== null && value > 0 && (
                    <div
                      className={`w-full rounded-t-[4px] ${s.className}`}
                      style={{ height: `${(value / max) * 100}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[11px] text-ink-2" aria-hidden="true">
        {activity.map((m, i) => (
          <span key={m.month} className="flex-1 text-center">
            {shortMonthLabel(m.month, i === 0 || m.month.endsWith("-01"))}
          </span>
        ))}
      </div>
      <p className="text-[13px] text-ink-2">
        Comptés à la date d&apos;enregistrement dans l&apos;app, hors questionnaire et reprise de l&apos;historique.
        Retards régularisés mesurés depuis le 5 octobre 2026.
      </p>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-accent">
          Voir les données
        </summary>
        <ActivityTable activity={activity} />
      </details>
    </div>
  );
}

export function ActivityTable({ activity }: { activity: MonthlyActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="text-left text-ink-2">
          <tr>
            <th className="px-2 py-1 font-medium">Mois</th>
            {ACTIVITY_SERIES.map((s) => (
              <th key={s.key} className="px-2 py-1 font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {activity.map((m) => (
            <tr key={m.month}>
              <td className="px-2 py-1 text-ink">{shortMonthLabel(m.month, true)}</td>
              <td className="px-2 py-1 text-ink-2">{m.interventions}</td>
              <td className="px-2 py-1 text-ink-2">{m.maintenanceDone}</td>
              <td className="px-2 py-1 text-ink-2">{m.overdueResolved ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
