import Link from "next/link";
import { PlaceSection } from "@/components/PlaceSection";
import { DemoDashboard } from "@/components/DemoDashboard";
import { SignOutButton } from "@/components/SignOutButton";
import { ComplianceBanner } from "@/components/ComplianceBanner";
import { getAppliances } from "@/lib/appliances";
import { getPlaces } from "@/lib/places";
import { comparePlacesByPropertyType } from "@/lib/place-types";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { countObligationsByStatus, getObligationsForAppliance, type ObligationCounts } from "@/lib/obligations";
import { getPlaceChecks } from "@/lib/place-checks";
import { auth } from "@/lib/auth/server";

// Every page here reads user data straight from Postgres: it must never be served
// from a static/ISR cache, or edits made outside the app (migrations, other users)
// would stay invisible until the next build.
export const dynamic = "force-dynamic";

export default async function Home() {
  // A signed-out visitor never triggers a database read on this page: the check below
  // is the only thing standing between "/" and a live query, so it must come first,
  // and the demo branch below must stay free of any call into src/lib/*.
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Electro Care
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Suivez les appareils de votre maison, connectez-vous pour commencer.
            </p>
          </header>

          <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/sign-in"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Se connecter
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Créer un compte
              </Link>
            </div>
          </section>

          <DemoDashboard />
        </main>
      </div>
    );
  }

  const [places, appliances] = await Promise.all([getPlaces(), getAppliances()]);
  const orderedPlaces = [...places].sort(comparePlacesByPropertyType);
  const placesData = await Promise.all(
    orderedPlaces.map(async (place) => ({
      place,
      appliances: appliances.filter((a) => a.placeId === place.id),
      obligationRecords: await getObligationRecordsForPlace(place.id),
      placeChecks: await getPlaceChecks(place.id),
    }))
  );

  const totalCounts = placesData.reduce<ObligationCounts>(
    (acc, { appliances: placeAppliances, obligationRecords }) => {
      for (const appliance of placeAppliances) {
        if (!appliance.equipmentTypeId) continue;
        const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
        const counts = countObligationsByStatus(getObligationsForAppliance(appliance.equipmentTypeId, records));
        acc.overdue += counts.overdue;
        acc.toConfirm += counts.toConfirm;
        acc.upToDate += counts.upToDate;
      }
      return acc;
    },
    { overdue: 0, toConfirm: 0, upToDate: 0 }
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Electro Care
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Suivez les appareils de votre maison.
            </p>
          </div>
          <SignOutButton />
        </header>

        {places.length > 0 && <ComplianceBanner counts={totalCounts} />}

        {places.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun lieu pour l&apos;instant.</p>
            <Link
              href="/places/new"
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Ajouter votre premier lieu
            </Link>
          </section>
        ) : (
          <>
            {placesData.map(({ place, appliances: placeAppliances, obligationRecords, placeChecks }) => (
              <PlaceSection
                key={place.id}
                place={place}
                appliances={placeAppliances}
                obligationRecords={obligationRecords}
                placeChecks={placeChecks}
              />
            ))}

            <div>
              <Link
                href="/places/new"
                className="inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Ajouter un lieu
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
