import Link from "next/link";
import type { MaintenanceTask } from "@/lib/maintenance-tasks";
import { Section } from "@/components/ui";

// "Ses routines, plus fréquentes que mensuelles" (spec's "Managing Appliances"):
// informational only — no due date, no place-page guidance, no completion tracking —
// each still opening its fiche for the procedure (item 1: every task line is clickable).
export function ApplianceRoutinesSection({ applianceId, routines }: { applianceId: string; routines: MaintenanceTask[] }) {
  if (routines.length === 0) return null;

  return (
    <Section title="Routines">
      <ul className="flex flex-col gap-2.5">
        {routines.map((task) => (
          <li key={task.id}>
            <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3.5">
              <span className="text-base font-semibold text-ink">{task.title}</span>
              <span className="text-sm text-ink-2">{task.frequency.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
