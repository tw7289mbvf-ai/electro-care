import Link from "next/link";
import type { MaintenanceGuidanceItem, UpcomingMaintenanceItem } from "@/lib/maintenance-guidance";
import { MaintenanceGuidanceActions } from "@/components/MaintenanceGuidanceActions";
import { ModifyMaintenanceCompletionButton } from "@/components/ModifyMaintenanceCompletionButton";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { GROUP_LABEL_CLASS, Pill, ROW_CLASS, Section } from "@/components/ui";

// Appliance fiche's "entretien courant, au niveau choisi pour le lieu" (spec's "Managing
// Appliances", revision 51): every lifespan task of the place's level, shown exactly
// once — "À faire" when due this month or overdue (same engine as the place page's
// "Entretien du mois", so the two never disagree), "À venir" otherwise, with its next
// month. Each line shows its last completion when there is one; there is no separate
// "Réalisé" group.
export function ApplianceEntretienSection({
  applianceId,
  placeId,
  pending,
  upcoming,
  deferrableTaskKeys,
  upgradeTaskCount,
  upgradeLevelLabel,
}: {
  applianceId: string;
  placeId: string;
  pending: MaintenanceGuidanceItem[];
  upcoming: UpcomingMaintenanceItem[];
  deferrableTaskKeys: Set<string>;
  // Set when this appliance has zero tasks at the place's current level but some at the
  // top level, so the section can point the user there instead of rendering nothing.
  upgradeTaskCount?: number;
  upgradeLevelLabel?: string;
}) {
  if (pending.length === 0 && upcoming.length === 0) {
    if (!upgradeTaskCount || !upgradeLevelLabel) return null;
    return (
      <Section title="Entretien">
        <p className="rounded-2xl bg-surface p-3.5 text-sm text-ink-2">
          Aucun geste indispensable pour cet appareil. Passez au niveau {upgradeLevelLabel} pour voir{" "}
          {upgradeTaskCount === 1 ? "son geste d'entretien" : `ses ${upgradeTaskCount} gestes d'entretien`}.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Entretien">
      {pending.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className={GROUP_LABEL_CLASS}>À faire</h3>
          <ul className="flex flex-col gap-2.5">
            {pending.map(({ task }) => (
              <li key={task.id} className={ROW_CLASS}>
                <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold text-ink">{task.title}</span>
                  <span className="text-sm text-ink-2">
                    {task.performer === "pro" ? "Par un professionnel" : `${task.activeMinutes} min, à faire soi-même`}
                  </span>
                </Link>
                <MaintenanceGuidanceActions
                  applianceId={applianceId}
                  maintenanceTaskId={task.id}
                  placeId={placeId}
                  canDefer={deferrableTaskKeys.has(task.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className={`${GROUP_LABEL_CLASS} pt-1.5`}>À venir</h3>
          <ul className="flex flex-col gap-2.5">
            {upcoming.map(({ task, completion, nextDate }) => (
              <li key={task.id} className={ROW_CLASS}>
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold text-ink">{task.title}</span>
                    <span className="text-sm text-ink-2">Prévu en {formatFrenchMonthYear(nextDate)}</span>
                    {completion && (
                      <span className="text-sm text-ink-2">Fait en {formatFrenchMonthYear(completion.doneMonth)}</span>
                    )}
                  </Link>
                  {task.performer === "pro" && <Pill tone="neutral">Professionnel</Pill>}
                </div>
                {completion && (
                  <div className="flex justify-end">
                    <ModifyMaintenanceCompletionButton
                      completionId={completion.id}
                      applianceId={applianceId}
                      maintenanceTaskId={task.id}
                      doneMonth={completion.doneMonth}
                      modifiedAt={completion.modifiedAt}
                      placeId={placeId}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
