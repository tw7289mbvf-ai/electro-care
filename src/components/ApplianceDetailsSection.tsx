"use client";

import { useState } from "react";
import type { FormState } from "@/app/actions";
import type { Appliance } from "@/lib/appliance-types";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ApplianceEditForm } from "@/components/ApplianceEditForm";
import { BUTTON_OUTLINE, Section } from "@/components/ui";
import { SmokeDetectorKindFlow } from "@/components/SmokeDetectorKindFlow";
import { WINDOW_CLASS, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import { SMOKE_DETECTOR_KIND_LABELS, getSmokeDetectorKind } from "@/lib/smoke-detectors";

// Fiche appareil "L'appareil" (docs/design.md): what is known, one line per field, and
// the existing edit form behind "Modifier les informations".
export function ApplianceDetailsSection({
  appliance,
  action,
}: {
  appliance: Appliance;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [editing, setEditing] = useState(false);
  const [changingKind, setChangingKind] = useState(false);
  const detectorKind = getSmokeDetectorKind(appliance.equipmentTypeId);

  const fields = [
    { label: "Marque", value: appliance.brand },
    { label: "Modèle", value: appliance.model },
    { label: "Puissance", value: appliance.powerKw !== null ? `${String(appliance.powerKw).replace(".", ",")} kW` : null },
    { label: "Date d'achat", value: appliance.purchaseDate ? formatFrenchMonthYear(appliance.purchaseDate) : null },
    { label: "Fin de garantie", value: appliance.warrantyEnd ? formatFrenchMonthYear(appliance.warrantyEnd) : null },
    { label: "Pièce", value: appliance.room },
  ].filter((field): field is { label: string; value: string } => Boolean(field.value));

  return (
    <Section title="L'appareil">
      {/* Smoke detector "Type" (spec, "Smoke detector"): changing it asks the new kind's
          questions and switches the obligations the detector carries. */}
      {detectorKind && (
        <div className="flex flex-col gap-2 rounded-[18px] bg-surface px-4 py-3 text-[15px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-2">Type</span>
            <span className="flex items-center gap-3">
              <span className="text-right font-semibold text-ink">{SMOKE_DETECTOR_KIND_LABELS[detectorKind]}</span>
              {!changingKind && (
                <button type="button" onClick={() => setChangingKind(true)} className={TEXT_BUTTON_CLASS}>
                  Changer
                </button>
              )}
            </span>
          </div>
          {changingKind && (
            <div className={WINDOW_CLASS}>
              <SmokeDetectorKindFlow
                applianceId={appliance.id}
                startAt="type"
                onDone={() => setChangingKind(false)}
                onCancel={() => setChangingKind(false)}
              />
            </div>
          )}
        </div>
      )}
      {fields.length > 0 && (
        <dl className="flex flex-col rounded-[18px] bg-surface px-4 py-1 text-[15px]">
          {fields.map((field) => (
            <div key={field.label} className="flex justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <dt className="text-ink-2">{field.label}</dt>
              <dd className="text-right font-semibold text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {editing ? (
        <ApplianceEditForm appliance={appliance} action={action} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={`${BUTTON_OUTLINE} w-full`}>
          {fields.length > 0 ? "Modifier les informations" : "Compléter les informations"}
        </button>
      )}
    </Section>
  );
}
