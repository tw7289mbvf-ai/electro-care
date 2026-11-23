import Link from "next/link";
import type { Appliance } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import type { ObligationView } from "@/lib/obligations";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { MarkDoneButton } from "@/components/MarkDoneButton";
import { ModifyObligationButton } from "@/components/ModifyObligationButton";
import { ObligationHistoryList } from "@/components/ObligationHistoryList";
import { AppointmentButton } from "@/components/AppointmentButton";
import { BookingRequestButton } from "@/components/BookingRequestButton";
import type { BookingRequestSummary } from "@/lib/booking-types";
import { ApplianceIconTile, Icon, ROW_CLASS, StatusPill, statusTone } from "@/components/ui";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { overdueSinceMonth } from "@/lib/obligations";
import type { ObligationAppointment } from "@/lib/obligation-appointments";
import { getDateQuestionForTask } from "@/lib/date-questions";

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
// On the fiche the appliance is already the page's subject: the row leads with the
// task instead (docs/design.md, fiche appareil).
// `bookingRequest` (an open "Prendre rendez-vous" request covering this obligation) and
// `bookable` are passed by ObligationsBlock on the place page and the fiche — the
// dashboard's UrgentActions leaves them out, so the booking button stays off it.
export function ObligationRow({
  appliance,
  history,
  appointment = null,
  bookable = false,
  bookingRequest = null,
  ...row
}: {
  appliance: Appliance;
  history?: ObligationCompletion[] | null;
  appointment?: ObligationAppointment | null;
  bookable?: boolean;
  bookingRequest?: BookingRequestSummary | null;
} & ObligationView) {
  const latest = history?.[0];
  const olderEntries = history?.slice(1) ?? [];
  const onFiche = history !== undefined && history !== null;

  // Dates are kept to the month: due this month reads « Échéance ce mois-ci » under the
  // orange « À planifier » pill; late from the first day of the following month, so
  // « En retard depuis » names that month, not the due month.
  const dateLine =
    row.status === "not_applicable"
      ? row.toConfirmReason === "date"
        ? "Non concerné pour cet appareil"
        : "Puissance sous le seuil de 4 kW"
      : row.noDeadline
        ? "Sans date limite"
        : row.dueDate
          ? row.status === "overdue"
            ? `En retard depuis ${formatFrenchMonthYear(overdueSinceMonth(row.dueDate))}`
            : row.status === "to_schedule"
              ? "Échéance ce mois-ci"
              : `Prochaine échéance en ${formatFrenchMonthYear(row.dueDate)}`
          : null;
  // Orange row: where to find the missing answer (e.g. the label on the detector or the
  // monitoring contract for the CE EN 14604 check).
  // Red row: what to do, when the seed says (e.g. replace a non-compliant detector).
  const dq = getDateQuestionForTask(row.task.id);
  const tip = row.status === "to_confirm" ? (dq?.tip ?? null) : row.status === "overdue" ? (dq?.overdueTip ?? null) : null;
  const completedLine = row.completedOn
    ? `Fait en ${formatFrenchMonthYear(row.completedOn)}${row.providerName ? ` par ${row.providerName}` : ""}${
        row.providerContact ? ` (${row.providerContact})` : ""
      }`
    : null;
  // One idea per line (docs/design.md): each risk on its own line, never joined.
  // A task-specific risk (seed `risk`) replaces the obligation's general ones.
  const risks = row.task.risk
    ? [row.task.risk]
    : [
        ...new Set(
          row.legalObligations.flatMap((o) =>
            o.risks ? [o.risks.danger, o.risks.insurance, o.risks.liability, o.risks.other] : []
          )
        ),
      ].filter((risk): risk is string => Boolean(risk));

  return (
    <li className={ROW_CLASS}>
      <div className="flex items-center gap-3">
        <Link href={`/appliances/${appliance.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {!onFiche && <ApplianceIconTile appliance={appliance} tone={statusTone(row.status)} />}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">
              {onFiche ? row.task.title : getApplianceDisplayName(appliance)}
            </span>
            {!onFiche && <span className="text-sm text-ink-2">{row.task.title}</span>}
          </span>
        </Link>
        <StatusPill status={row.status} label={row.statusLabel} />
      </div>

      {(dateLine || tip || completedLine || risks.length > 0) && (
        <div className="flex flex-col gap-1 text-sm text-ink-2">
          {dateLine && <p>{dateLine}</p>}
          {tip && <p>{tip}</p>}
          {completedLine && (
            <p className="flex items-center gap-2">
              <Icon name="person" size={18} />
              {completedLine}
            </p>
          )}
          {risks.map((risk) => (
            <p key={risk} className="text-[13px]">
              {risk}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">
        {bookable && !appointment && (
          <BookingRequestButton
            placeId={appliance.placeId}
            applianceId={appliance.id}
            maintenanceTaskId={row.task.id}
            summary={bookingRequest}
          />
        )}
        <AppointmentButton
          applianceId={appliance.id}
          maintenanceTaskId={row.task.id}
          status={row.status}
          performer={row.task.performer}
          appointment={appointment}
        />
        {!appointment && (
          <MarkDoneButton
            applianceId={appliance.id}
            maintenanceTaskId={row.task.id}
            status={row.status}
            toConfirmReason={row.toConfirmReason}
            onFiche={onFiche}
          />
        )}
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
    </li>
  );
}
