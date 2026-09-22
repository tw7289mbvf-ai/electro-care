import { ApplianceForm } from "@/components/ApplianceForm";
import { PlaceForm } from "@/components/PlaceForm";
import { PlaceSection } from "@/components/PlaceSection";
import { getAppliances } from "@/lib/appliances";
import { getPlaces } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getPlaceChecks } from "@/lib/place-checks";
import { createPlace } from "@/app/actions";

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
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Electro Care
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Suivez les appareils de votre maison.
          </p>
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
