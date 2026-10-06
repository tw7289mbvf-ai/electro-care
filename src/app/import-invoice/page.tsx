import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlaces } from "@/lib/places";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";
import { BackLink } from "@/components/ui";

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
      <div className="min-h-screen">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
          <BackLink href="/">Retour</BackLink>
          <p className="rounded-2xl border-[1.5px] border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
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
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/">Retour</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Importer une facture
          </h1>
          <p className="mt-1 text-sm text-ink-2">Pour quel lieu ?</p>
        </header>

        {places.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
            Ajoutez d&apos;abord un lieu pour pouvoir y importer une facture.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/places/${place.id}/import-invoice`}
                  className="block rounded-2xl bg-surface px-4 py-3.5 text-[15px] font-semibold text-ink"
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
