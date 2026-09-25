import Link from "next/link";
import { PROPERTY_TYPE_LABELS, type Place } from "@/lib/place-types";
import type { ObligationCounts } from "@/lib/obligations";

// Dashboard "one card per place": name, property type and status dots — nothing else.
// Tapping it opens the place page with obligations, this month's maintenance and its
// appliances.
export function PlaceCard({
  place,
  counts,
  maintenanceDueCount,
}: {
  place: Place;
  counts: ObligationCounts;
  maintenanceDueCount: number;
}) {
  const nothingToShow = counts.overdue + counts.toConfirm + counts.upToDate === 0 && maintenanceDueCount === 0;

  return (
    <Link
      href={place.onboardedAt ? `/places/${place.id}` : `/places/${place.id}/questionnaire`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{place.name}</h3>
        {!place.onboardedAt && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Compléter le questionnaire
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {[place.commune, place.postcode, place.propertyType ? PROPERTY_TYPE_LABELS[place.propertyType] : null]
          .filter(Boolean)
          .join(" · ") || "Aucune information complémentaire"}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {counts.overdue > 0 && (
          <span className="font-medium text-red-600 dark:text-red-400">{counts.overdue} en retard</span>
        )}
        {counts.toConfirm > 0 && (
          <span className="font-medium text-orange-600 dark:text-orange-400">{counts.toConfirm} à confirmer</span>
        )}
        {counts.upToDate > 0 && (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{counts.upToDate} à jour</span>
        )}
        {maintenanceDueCount > 0 && (
          <span className="text-zinc-500 dark:text-zinc-400">
            {maintenanceDueCount} geste{maintenanceDueCount > 1 ? "s" : ""} d&apos;entretien ce mois-ci
          </span>
        )}
        {nothingToShow && <span className="text-zinc-400 dark:text-zinc-500">Rien à signaler</span>}
      </div>
    </Link>
  );
}
