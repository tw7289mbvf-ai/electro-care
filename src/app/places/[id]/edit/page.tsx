import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceForm } from "@/components/PlaceForm";
import { DeletePlaceButton } from "@/components/DeletePlaceButton";
import { getPlace } from "@/lib/places";
import { countAppliancesForPlace } from "@/lib/appliances";
import { updatePlace } from "@/app/actions";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }
  const applianceCount = await countAppliancesForPlace(id);
  const confirmMessage =
    applianceCount > 0
      ? `Supprimer « ${place.name} » supprime aussi ${applianceCount} appareil${applianceCount > 1 ? "s" : ""} et leurs rappels. Continuer ?`
      : `Supprimer « ${place.name} » ? Cette action est définitive.`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link
            href={`/places/${place.id}`}
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            ← Retour
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Modifier le lieu
          </h1>
        </header>

        <PlaceForm
          place={place}
          action={updatePlace.bind(null, place.id)}
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement…"
        />

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Zone de danger
          </h2>
          <DeletePlaceButton id={place.id} confirmMessage={confirmMessage} />
        </section>
      </main>
    </div>
  );
}
