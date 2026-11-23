"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { MaintenanceTask } from "@/lib/maintenance-tasks";
import { restoreMaintenanceTaskAction } from "@/app/actions";
import { BUTTON_NEUTRAL, GROUP_LABEL_CLASS, Icon, ROW_CLASS } from "@/components/ui";

// Appliance card (spec "Maintenance Guidance"): the maintenance tasks ruled out for this
// appliance (« Mon appareil n'a pas cet élément »), in a collapsed « Non concerné » group,
// each with « Rétablir ».
export function NotApplicableTasksGroup({
  applianceId,
  placeId,
  tasks,
}: {
  applianceId: string;
  placeId: string;
  tasks: MaintenanceTask[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl bg-neutral-soft p-3.5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={GROUP_LABEL_CLASS}>Non concerné</span>
          <span className="text-sm text-ink-2">
            {tasks.length === 1 ? "1 tâche d'entretien écartée pour cet appareil" : `${tasks.length} tâches d'entretien écartées pour cet appareil`}
          </span>
        </span>
        <span className="text-ink-2">
          <Icon name={open ? "up" : "down"} size={20} strokeWidth={2} />
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-2.5">
          {tasks.map((task) => (
            <li key={task.id} className={ROW_CLASS}>
              <div className="flex items-center justify-between gap-3">
                <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="min-w-0 text-base font-semibold text-ink">
                  {task.title}
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => restoreMaintenanceTaskAction(applianceId, task.id, placeId))}
                  className={BUTTON_NEUTRAL}
                >
                  Rétablir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
