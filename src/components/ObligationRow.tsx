import type { Appliance } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { OBLIGATION_STATUS_LABELS, type ObligationStatus, type ObligationView } from "@/lib/obligations";
import { MarkDoneButton } from "@/components/MarkDoneButton";
import { formatFrenchMonthYear } from "@/lib/french-dates";

export const OBLIGATION_STATUS_STYLES: Record<ObligationStatus, string> = {
  up_to_date: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  to_schedule: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  to_confirm: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
};

// Shared by ObligationsBlock (a place's or an appliance's full list) and UrgentActions
// (the dashboard's overdue-only, grouped-by-place view) so both render the same row.
export function ObligationRow({ appliance, ...row }: { appliance: Appliance } & ObligationView) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${OBLIGATION_STATUS_STYLES[row.status]}`}>
          {OBLIGATION_STATUS_LABELS[row.status]}
        </span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {getApplianceDisplayName(appliance)}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">— {row.task.title}</span>
        {row.dueDate && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            ({row.status === "overdue" ? "depuis" : "prochaine échéance :"} {formatFrenchMonthYear(row.dueDate)})
          </span>
        )}
        <MarkDoneButton
          applianceId={appliance.id}
          maintenanceTaskId={row.task.id}
          status={row.status}
          toConfirmReason={row.toConfirmReason}
        />
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
  );
}
