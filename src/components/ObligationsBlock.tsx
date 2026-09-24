import type { Appliance } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import {
  compareObligationsByUrgency,
  getObligationsForAppliance,
  OBLIGATION_STATUS_LABELS,
  type ApplianceObligationRecord,
  type ObligationStatus,
} from "@/lib/obligations";
import type { PlaceCheck } from "@/lib/place-checks";
import { MarkDoneButton } from "@/components/MarkDoneButton";

const STATUS_STYLES: Record<ObligationStatus, string> = {
  up_to_date: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  to_schedule: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  to_confirm: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

export function ObligationsBlock({
  appliances,
  obligationRecords,
  placeChecks,
}: {
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  placeChecks: PlaceCheck[];
}) {
  const rows = appliances
    .flatMap((appliance) => {
      if (!appliance.equipmentTypeId) return [];
      const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
      return getObligationsForAppliance(appliance.equipmentTypeId, records).map((obligation) => ({
        appliance,
        ...obligation,
      }));
    })
    .sort(compareObligationsByUrgency);

  if (rows.length === 0 && placeChecks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Obligations
      </h3>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={`${row.appliance.id}-${row.task.id}`} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                  {OBLIGATION_STATUS_LABELS[row.status]}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {getApplianceDisplayName(row.appliance)}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">— {row.task.title}</span>
                {row.dueDate && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    ({row.status === "overdue" ? "depuis le" : "prochaine échéance :"} {formatDate(row.dueDate)})
                  </span>
                )}
                <MarkDoneButton applianceId={row.appliance.id} maintenanceTaskId={row.task.id} />
              </div>
              {row.legalObligations.map((obligation) =>
                obligation.risks ? (
                  <p key={obligation.id} className="pl-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {[obligation.risks.danger, obligation.risks.insurance, obligation.risks.liability, obligation.risks.other]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null
              )}
            </li>
          ))}
        </ul>
      )}

      {placeChecks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            À vérifier
          </h4>
          <ul className="flex flex-col gap-1.5">
            {placeChecks.map((check) => (
              <li key={check.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                {check.questionLabel}
                {check.help && <span className="block text-xs text-zinc-400 dark:text-zinc-500">{check.help}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
