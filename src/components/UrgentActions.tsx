import Link from "next/link";
import type { Appliance } from "@/lib/appliance-types";
import type { Place } from "@/lib/place-types";
import { compareObligationsByUrgency, getObligationsForAppliance, type ApplianceObligationRecord } from "@/lib/obligations";
import type { ObligationAppointment } from "@/lib/obligation-appointments";
import { ObligationRow } from "@/components/ObligationRow";

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
    <section className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-sm sm:p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
        À faire maintenant
      </h2>
      {groups.map(({ place, rows }) => (
        <div key={place.id} className="flex flex-col gap-2">
          <Link
            href={`/places/${place.id}`}
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {place.name}
          </Link>
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
