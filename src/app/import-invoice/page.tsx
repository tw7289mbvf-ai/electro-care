import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlaces } from "@/lib/places";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Dashboard-level entry point: it only picks which place the import applies to. The
// actual upload-and-confirm parcours lives at /places/[id]/import-invoice, so there is
// one implementation of that flow, reached from three entry points (spec: "in the
// questionnaire ... and from the dashboard or a place page").
export default async function ImportInvoicePickerPage() {
  const isAdmin = (await requireAdminRoute()) !== null;
  const mode = getInvoiceImportMode(isAdmin);

  if (mode === "disabled") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
          <Link href="/" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            ← Retour
          </Link>
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Import de factures : bientôt disponible.
          </p>
        </main>
      </div>
    );
  }

  const places = await getPlaces();
  if (places.length === 1) {
    redirect(`/places/${places[0].id}/import-invoice`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link href="/" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            ← Retour
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Importer une facture
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Pour quel lieu ?</p>
        </header>

        {places.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Ajoutez d&apos;abord un lieu pour pouvoir y importer une facture.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/places/${place.id}/import-invoice`}
                  className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {place.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
