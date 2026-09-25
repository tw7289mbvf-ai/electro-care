import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/appliance-types";
import { PROPERTY_TYPE_LABELS } from "@/lib/place-types";
import { getPlace } from "@/lib/places";
import { getAppliances } from "@/lib/appliances";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getPlaceChecks } from "@/lib/place-checks";
import { getMaintenanceCompletionsForPlace } from "@/lib/maintenance-completions";
import { getMaintenanceGuidanceForAppliances, filterPendingGuidance } from "@/lib/maintenance-guidance";
import { currentMonthKey } from "@/lib/french-dates";
import { ObligationsBlock } from "@/components/ObligationsBlock";
import { MaintenanceGuidanceList } from "@/components/MaintenanceGuidanceList";
import { ApplianceList } from "@/components/ApplianceList";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }

  const [allAppliances, obligationRecords, placeChecks, completions] = await Promise.all([
    getAppliances(),
    getObligationRecordsForPlace(id),
    getPlaceChecks(id),
    getMaintenanceCompletionsForPlace(id, currentMonthKey()),
  ]);
  const appliances = allAppliances.filter((a) => a.placeId === id);
  const guidance = filterPendingGuidance(getMaintenanceGuidanceForAppliances(appliances), completions);

  const byCategory = CATEGORIES.map((category) => ({
    category,
    appliances: appliances.filter((a) => a.category === category),
  })).filter((group) => group.appliances.length > 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link href="/" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            ← Retour
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
                {place.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {[place.commune, place.postcode, place.propertyType ? PROPERTY_TYPE_LABELS[place.propertyType] : null]
                  .filter(Boolean)
                  .join(" · ") || "Aucune information complémentaire"}
              </p>
            </div>
            <Link
              href={`/places/${place.id}/edit`}
              className="shrink-0 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Modifier
            </Link>
          </div>
          {!place.onboardedAt && (
            <Link
              href={`/places/${place.id}/questionnaire`}
              className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Compléter le questionnaire pour ce lieu
            </Link>
          )}
        </header>

        <ObligationsBlock appliances={appliances} obligationRecords={obligationRecords} placeChecks={placeChecks} />

        <MaintenanceGuidanceList items={guidance} />

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Appareils
            </h2>
            <Link
              href={`/places/${place.id}/appliances/new`}
              className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Ajouter un appareil
            </Link>
          </div>

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
      </main>
    </div>
  );
}
