import { notFound } from "next/navigation";
import { InvoiceImportFlow } from "@/components/InvoiceImportFlow";
import { getPlace } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";
import { BackLink } from "@/components/ui";

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
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href={`/places/${place.id}`}>{place.name}</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Importer une facture
          </h1>
        </header>

        {mode === "disabled" ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
            Import de factures : bientôt disponible.
          </p>
        ) : (
          <InvoiceImportFlow placeId={place.id} mode={mode} equipmentTypes={IMPORT_FLOW_EQUIPMENT_TYPES} />
        )}
      </main>
    </div>
  );
}
