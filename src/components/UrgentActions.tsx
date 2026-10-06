import Link from "next/link";
import type { Appliance } from "@/lib/appliance-types";
import type { Place } from "@/lib/place-types";
import { compareObligationsByUrgency, getObligationsForAppliance, type ApplianceObligationRecord } from "@/lib/obligations";
import type { ObligationAppointment } from "@/lib/obligation-appointments";
import { ObligationRow } from "@/components/ObligationRow";
import { GROUP_LABEL_CLASS, Section } from "@/components/ui";

type PlaceData = {
  place: Place;
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  appointments: ObligationAppointment[];
};

// Dashboard "À faire maintenant": only overdue (red) obligations, grouped under each
// place's name, each with its "C'est fait" button — everything else waits for the
// place page. A pending "Rendez-vous pris" leaves this list entirely (spec's "Managing
// Appliances"), whether or not its date has already passed — the "a-t-il eu lieu ?"
// question only makes sense on the place page or the appliance fiche.
export function UrgentActions({ placesData }: { placesData: PlaceData[] }) {
  const groups = placesData
    .map(({ place, appliances, obligationRecords, appointments }) => {
      const rows = appliances
        .flatMap((appliance) => {
          if (!appliance.equipmentTypeId) return [];
          const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
          return getObligationsForAppliance(appliance.equipmentTypeId, records, appliance.powerKw)
            .filter(
              (o) =>
                o.status === "overdue" &&
                !appointments.some((a) => a.applianceId === appliance.id && a.maintenanceTaskId === o.task.id)
            )
            .map((o) => ({ appliance, ...o }));
        })
        .sort(compareObligationsByUrgency);
      return { place, rows };
    })
    .filter((g) => g.rows.length > 0);

  if (groups.length === 0) return null;

  return (
    <Section title="À faire maintenant">
      {groups.map(({ place, rows }) => (
        <div key={place.id} className="flex flex-col gap-2.5">
          <Link href={`/places/${place.id}`} className={`${GROUP_LABEL_CLASS} inline-flex min-h-11 items-center self-start`}>
            {place.name}
          </Link>
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
