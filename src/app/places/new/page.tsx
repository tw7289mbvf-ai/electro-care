import Link from "next/link";
import { PlaceForm } from "@/components/PlaceForm";
import { createPlace } from "@/app/actions";

export const dynamic = "force-dynamic";

export default function NewPlacePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link href="/" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            ← Retour
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Ajouter un lieu
          </h1>
        </header>

        <PlaceForm action={createPlace} submitLabel="Ajouter le lieu" pendingLabel="Ajout…" />
      </main>
    </div>
  );
}
