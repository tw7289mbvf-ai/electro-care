import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { getAppliances, countInterventionsByAppliance } from "@/lib/appliances";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getEquipmentType } from "@/lib/equipment-types";
import { CATEGORY_LABELS } from "@/lib/appliance-types";
import { SMOKE_DETECTOR_NAME, getSmokeDetectorKind } from "@/lib/smoke-detectors";
import { withDemonstrative } from "@/lib/appliance-checklist";
import { ApplianceChecklistFlow } from "@/components/ApplianceChecklistFlow";
import { BackLink, PAGE_CLASS, PAGE_TITLE_CLASS } from "@/components/ui";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Opened from the place page: "Voulez-vous le suivre ?" on a place at Aucun (checklist,
// then level, then recap), "Ajouter plusieurs appareils" on a place already followed
// (checklist, then recap).
export default async function ApplianceChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }
  const [allAppliances, interventionCounts] = await Promise.all([getAppliances(), countInterventionsByAppliance(id)]);
  const existing = allAppliances
    .filter((a) => a.placeId === id)
    .map((a) => {
      const typeLabel = getEquipmentType(a.equipmentTypeId)?.label ?? CATEGORY_LABELS[a.category];
      return {
        id: a.id,
        equipmentTypeId: a.equipmentTypeId,
        label: getApplianceDisplayName(a),
        // A name typed by the user is quoted; otherwise "ce lave-linge".
        warningName: a.name
          ? `« ${a.name} »`
          : withDemonstrative(getSmokeDetectorKind(a.equipmentTypeId) ? SMOKE_DETECTOR_NAME : typeLabel),
        interventionCount: interventionCounts[a.id] ?? 0,
        // Mandatory in every home, always created by the questionnaire: never unticked here.
        locked: getSmokeDetectorKind(a.equipmentTypeId) !== null,
      };
    });
  const resuming = place.maintenanceLevel === "none";

  return (
    <main className={PAGE_CLASS}>
      <header className="flex flex-col gap-2.5">
        <BackLink href={`/places/${place.id}`}>{place.name}</BackLink>
        <h1 className={PAGE_TITLE_CLASS}>{resuming ? "Suivre l'entretien" : "Ajouter plusieurs appareils"}</h1>
      </header>
      <ApplianceChecklistFlow placeId={place.id} existing={existing} resuming={resuming} />
    </main>
  );
}
