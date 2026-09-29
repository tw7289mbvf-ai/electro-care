import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceImportFlow } from "@/components/InvoiceImportFlow";
import { getPlace } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same projection as src/app/places/[id]/appliances/new/page.tsx: id/category/label
// only, to keep legalStatus (server-only) out of the client bundle.
const IMPORT_FLOW_EQUIPMENT_TYPES = EQUIPMENT_TYPES.map((t) => ({
  id: t.id,
  category: t.category,
  label: t.label,
}));

export default async function ImportInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }

  const isAdmin = (await requireAdminRoute()) !== null;
  const mode = getInvoiceImportMode(isAdmin);

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
            Importer une facture — {place.name}
          </h1>
        </header>

        {mode === "disabled" ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Import de factures : bientôt disponible.
          </p>
        ) : (
          <InvoiceImportFlow placeId={place.id} mode={mode} equipmentTypes={IMPORT_FLOW_EQUIPMENT_TYPES} />
        )}
      </main>
    </div>
  );
}
