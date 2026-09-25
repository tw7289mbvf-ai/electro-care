import type { ObligationCounts } from "@/lib/obligations";

const ITEM_CLASS: Record<keyof ObligationCounts, string> = {
  overdue: "text-red-600 dark:text-red-400",
  toConfirm: "text-orange-600 dark:text-orange-400",
  upToDate: "text-emerald-600 dark:text-emerald-400",
};

// "Only green counts as compliant": the banner leads with what still needs action.
// Global status first (spec's "Dashboard"): the three counts, then this month's
// lifespan maintenance count across every place.
export function ComplianceBanner({
  counts,
  maintenanceDueCount = 0,
}: {
  counts: ObligationCounts;
  maintenanceDueCount?: number;
}) {
  if (counts.overdue + counts.toConfirm + counts.upToDate === 0 && maintenanceDueCount === 0) return null;

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-semibold ${ITEM_CLASS.overdue}`}>
          {counts.overdue} en retard
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className={`font-semibold ${ITEM_CLASS.toConfirm}`}>
          {counts.toConfirm} à confirmer
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className={`font-semibold ${ITEM_CLASS.upToDate}`}>
          {counts.upToDate} à jour
        </span>
      </div>
      {maintenanceDueCount > 0 && (
        <p className="text-zinc-500 dark:text-zinc-400">
          {maintenanceDueCount} geste{maintenanceDueCount > 1 ? "s" : ""} d&apos;entretien ce mois-ci
        </p>
      )}
    </section>
  );
}
