import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS, type Appliance } from "@/lib/appliance-types";
import { PROPERTY_TYPE_LABELS, type Place } from "@/lib/place-types";
import type { ApplianceObligationRecord } from "@/lib/obligations";
import type { PlaceCheck } from "@/lib/place-checks";
import { ApplianceList } from "@/components/ApplianceList";
import { ObligationsBlock } from "@/components/ObligationsBlock";

export function PlaceSection({
  place,
  appliances,
  obligationRecords,
  placeChecks,
}: {
  place: Place;
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  placeChecks: PlaceCheck[];
}) {
  const byCategory = CATEGORIES.map((category) => ({
    category,
    appliances: appliances.filter((a) => a.category === category),
  })).filter((group) => group.appliances.length > 0);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{place.name}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {[place.commune, place.postcode, place.propertyType ? PROPERTY_TYPE_LABELS[place.propertyType] : null]
              .filter(Boolean)
              .join(" · ") || "Aucune information complémentaire"}
          </p>
          {!place.onboardedAt && (
            <Link
              href={`/places/${place.id}/questionnaire`}
              className="mt-1 inline-block text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Compléter le questionnaire pour ce lieu
            </Link>
          )}
        </div>
        <Link
          href={`/places/${place.id}`}
          className="shrink-0 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Modifier
        </Link>
      </header>

      <ObligationsBlock appliances={appliances} obligationRecords={obligationRecords} placeChecks={placeChecks} />

      {byCategory.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Aucun appareil pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {byCategory.map(({ category, appliances: categoryAppliances }) => (
            <div key={category} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {CATEGORY_LABELS[category]}
              </h3>
              <ApplianceList appliances={categoryAppliances} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
