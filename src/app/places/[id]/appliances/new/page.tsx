import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplianceForm } from "@/components/ApplianceForm";
import { getPlace } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ApplianceForm only needs id/category/label for its dropdowns: projected here rather
// than passed the full EQUIPMENT_TYPES (which also carries legalStatus, used
// server-side only by src/lib/obligations.ts) to keep that out of the client bundle.
const APPLIANCE_FORM_EQUIPMENT_TYPES = EQUIPMENT_TYPES.map((t) => ({
  id: t.id,
  category: t.category,
  label: t.label,
}));

export default async function NewAppliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }

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
            Ajouter un appareil — {place.name}
          </h1>
        </header>

        <ApplianceForm
          places={[place]}
          equipmentTypes={APPLIANCE_FORM_EQUIPMENT_TYPES}
          defaultPlaceId={place.id}
        />
      </main>
    </div>
  );
}
