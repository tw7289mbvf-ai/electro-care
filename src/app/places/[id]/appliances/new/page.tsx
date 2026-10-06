import { notFound } from "next/navigation";
import { ApplianceForm } from "@/components/ApplianceForm";
import { getPlace } from "@/lib/places";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { BackLink } from "@/components/ui";

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
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href={`/places/${place.id}`}>{place.name}</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Ajouter un appareil
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
