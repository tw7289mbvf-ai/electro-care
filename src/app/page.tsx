import { ApplianceForm } from "@/components/ApplianceForm";
import { PlaceForm } from "@/components/PlaceForm";
import { PlaceSection } from "@/components/PlaceSection";
import { getAppliances } from "@/lib/appliances";
import { getPlaces } from "@/lib/places";
import { createPlace } from "@/app/actions";

// Every page here reads user data straight from Postgres: it must never be served
// from a static/ISR cache, or edits made outside the app (migrations, other users)
// would stay invisible until the next build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [places, appliances] = await Promise.all([getPlaces(), getAppliances()]);

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

        <ApplianceForm places={places} />

        {places.map((place) => (
          <PlaceSection
            key={place.id}
            place={place}
            appliances={appliances.filter((a) => a.placeId === place.id)}
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
