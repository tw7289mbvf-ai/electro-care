"use client";

import { useState } from "react";
import type { FormState } from "@/app/actions";
import type { Appliance } from "@/lib/appliance-types";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ApplianceEditForm } from "@/components/ApplianceEditForm";
import { BUTTON_OUTLINE, Section } from "@/components/ui";

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
