import Link from "next/link";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { formatDuration } from "@/lib/durations";
import type { MaintenanceGuidanceItem } from "@/lib/maintenance-guidance";
import { MaintenanceGuidanceActions } from "@/components/MaintenanceGuidanceActions";
import { ApplianceIconTile, ROW_CLASS, Section } from "@/components/ui";

// Place page "l'entretien du mois": lifespan maintenance tasks due this month, each
// leading to its fiche de tâche for the procedure, with "C'est fait" and "Reporter"
// right on the row.
export function MaintenanceGuidanceList({
  items,
  placeId,
  deferrableTaskKeys,
}: {
  items: MaintenanceGuidanceItem[];
  placeId: string;
  deferrableTaskKeys: Set<string>;
}) {
  if (items.length === 0) return null;

  const totalMinutes = items.reduce((sum, { task }) => sum + task.activeMinutes, 0);

  return (
    <Section
      title="Entretien du mois"
      aside={totalMinutes > 0 && <span className="text-sm text-ink-2">environ {formatDuration(totalMinutes)}</span>}
    >
      <ul className="flex flex-col gap-2.5">
        {items.map(({ appliance, task }) => (
          <li key={`${appliance.id}-${task.id}`} className={ROW_CLASS}>
            <Link href={`/appliances/${appliance.id}/tasks/${task.id}`} className="flex min-w-0 items-center gap-3">
              <ApplianceIconTile appliance={appliance} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold text-ink">{task.title}</span>
                <span className="text-sm text-ink-2">
                  {getApplianceDisplayName(appliance)}, {task.performer === "pro" ? "professionnel" : formatDuration(task.activeMinutes)}
                </span>
              </span>
            </Link>
            <MaintenanceGuidanceActions
              applianceId={appliance.id}
              maintenanceTaskId={task.id}
              placeId={placeId}
              canDefer={deferrableTaskKeys.has(`${appliance.id}:${task.id}`)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
