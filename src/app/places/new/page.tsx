import { PlaceForm } from "@/components/PlaceForm";
import { createPlace } from "@/app/actions";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NewPlacePage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/">Retour</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Ajouter un lieu
          </h1>
        </header>

        <PlaceForm action={createPlace} submitLabel="Ajouter le lieu" pendingLabel="Ajout…" />
      </main>
    </div>
  );
}
