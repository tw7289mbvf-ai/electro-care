import { notFound } from "next/navigation";
import { PlaceForm } from "@/components/PlaceForm";
import { DeletePlaceButton } from "@/components/DeletePlaceButton";
import { getPlace } from "@/lib/places";
import { countAppliancesForPlace } from "@/lib/appliances";
import { updatePlace } from "@/app/actions";
import { BackLink } from "@/components/ui";

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
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href={`/places/${place.id}`}>Retour</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Modifier le lieu
          </h1>
        </header>

        <PlaceForm
          place={place}
          action={updatePlace.bind(null, place.id)}
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement…"
        />

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink-2">
            Zone de danger
          </h2>
          <DeletePlaceButton id={place.id} confirmMessage={confirmMessage} />
        </section>
      </main>
    </div>
  );
}
