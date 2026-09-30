import Link from "next/link";
import type { Appliance } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { OBLIGATION_STATUS_LABELS, type ObligationStatus, type ObligationView } from "@/lib/obligations";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { MarkDoneButton } from "@/components/MarkDoneButton";
import { ModifyObligationButton } from "@/components/ModifyObligationButton";
import { ObligationHistoryList } from "@/components/ObligationHistoryList";
import { AppointmentButton } from "@/components/AppointmentButton";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import type { ObligationAppointment } from "@/lib/obligation-appointments";

export const OBLIGATION_STATUS_STYLES: Record<ObligationStatus, string> = {
  up_to_date: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  to_schedule: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  to_confirm: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  not_applicable: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

// Shared by ObligationsBlock (a place's or an appliance's full list) and UrgentActions
// (the dashboard's overdue-only, grouped-by-place view) so both render the same row.
// Spec "Managing Appliances": every line opens the appliance's fiche, whatever its
// status — so the informational part is a Link, and the action buttons stay outside it
// as siblings (a button nested in an anchor would fire both on one click).
//
// `history` (full "C'est fait" history, most recent first) is only ever passed by
// ObligationsBlock on the appliance fiche — never on the dashboard or a place page — so
// "Modifier" and the collapsed history list only ever render there, per spec: "Modifier
// appears only on the appliance card, never in the dashboard or place page lists".
export function ObligationRow({
  appliance,
  history,
  appointment = null,
  ...row
}: {
  appliance: Appliance;
  history?: ObligationCompletion[] | null;
  appointment?: ObligationAppointment | null;
} & ObligationView) {
  const latest = history?.[0];
  const olderEntries = history?.slice(1) ?? [];
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/appliances/${appliance.id}`} className="flex flex-wrap items-center gap-2 hover:underline">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${OBLIGATION_STATUS_STYLES[row.status]}`}>
            {OBLIGATION_STATUS_LABELS[row.status]}
          </span>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {getApplianceDisplayName(appliance)}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">— {row.task.title}</span>
          {row.status === "not_applicable" && (
            <span className="text-sm text-zinc-400 dark:text-zinc-500">
              (puissance sous le seuil de 4 kW)
            </span>
          )}
          {row.dueDate && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              ({row.status === "overdue" ? "depuis" : "prochaine échéance :"} {formatFrenchMonthYear(row.dueDate)})
            </span>
          )}
          {row.completedOn && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Fait en {formatFrenchMonthYear(row.completedOn)}
              {row.providerName ? ` par ${row.providerName}` : ""}
              {row.providerContact ? ` (${row.providerContact})` : ""}
            </span>
          )}
        </Link>
        {!appointment && (
          <MarkDoneButton
            applianceId={appliance.id}
            maintenanceTaskId={row.task.id}
            status={row.status}
            toConfirmReason={row.toConfirmReason}
          />
        )}
        <AppointmentButton
          applianceId={appliance.id}
          maintenanceTaskId={row.task.id}
          status={row.status}
          appointment={appointment}
        />
        {row.completedOn && latest && (
          <ModifyObligationButton
            completionId={latest.id}
            applianceId={appliance.id}
            maintenanceTaskId={row.task.id}
            completedOn={row.completedOn}
            providerName={row.providerName}
            providerContact={row.providerContact}
            modifiedAt={row.modifiedAt}
          />
        )}
      </div>
      {history && (
        <ObligationHistoryList olderEntries={olderEntries} applianceId={appliance.id} maintenanceTaskId={row.task.id} />
      )}
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
