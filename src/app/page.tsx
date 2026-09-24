import Link from "next/link";
import { ApplianceForm } from "@/components/ApplianceForm";
import { PlaceForm } from "@/components/PlaceForm";
import { PlaceSection } from "@/components/PlaceSection";
import { DemoDashboard } from "@/components/DemoDashboard";
import { SignOutButton } from "@/components/SignOutButton";
import { getAppliances } from "@/lib/appliances";
import { getPlaces } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getPlaceChecks } from "@/lib/place-checks";
import { createPlace } from "@/app/actions";
import { auth } from "@/lib/auth/server";

// Every page here reads user data straight from Postgres: it must never be served
// from a static/ISR cache, or edits made outside the app (migrations, other users)
// would stay invisible until the next build.
export const dynamic = "force-dynamic";

// ApplianceForm only needs id/category/label for its dropdowns: projected here rather
// than passed the full EQUIPMENT_TYPES (which also carries legalStatus, used
// server-side only by src/lib/obligations.ts) to keep that out of the client bundle.
const APPLIANCE_FORM_EQUIPMENT_TYPES = EQUIPMENT_TYPES.map((t) => ({
  id: t.id,
  category: t.category,
  label: t.label,
}));

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
  const placesData = await Promise.all(
    places.map(async (place) => ({
      place,
      appliances: appliances.filter((a) => a.placeId === place.id),
      obligationRecords: await getObligationRecordsForPlace(place.id),
      placeChecks: await getPlaceChecks(place.id),
    }))
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

        <ApplianceForm places={places} equipmentTypes={APPLIANCE_FORM_EQUIPMENT_TYPES} />

        {placesData.map(({ place, appliances: placeAppliances, obligationRecords, placeChecks }) => (
          <PlaceSection
            key={place.id}
            place={place}
            appliances={placeAppliances}
            obligationRecords={obligationRecords}
            placeChecks={placeChecks}
          />
        ))}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Ajouter un lieu</h2>
          <PlaceForm action={createPlace} submitLabel="Ajouter le lieu" pendingLabel="Ajout…" resetOnSuccess />
        </section>
      </main>
    </div>
  );
}
