import {
  MAINTENANCE_LEVELS,
  MAINTENANCE_LEVEL_LABELS,
  MAINTENANCE_LEVEL_DESCRIPTIONS,
  type MaintenanceLevel,
} from "@/lib/maintenance-levels";

const OPTION_CLASS =
  "flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 hover:border-emerald-400 cursor-pointer dark:border-zinc-700 dark:text-zinc-100";

export function MaintenanceLevelOptions({
  value,
  onChange,
  estimates,
  levels = MAINTENANCE_LEVELS,
}: {
  value: MaintenanceLevel;
  onChange: (level: MaintenanceLevel) => void;
  estimates: Record<MaintenanceLevel, number>;
  levels?: readonly MaintenanceLevel[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {levels.map((level) => (
        <label key={level} className={OPTION_CLASS}>
          <input
            type="radio"
            name="maintenanceLevel"
            checked={value === level}
            onChange={() => onChange(level)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{MAINTENANCE_LEVEL_LABELS[level]}</span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {MAINTENANCE_LEVEL_DESCRIPTIONS[level]}
              {level !== "none" && ` Environ ${estimates[level]} min/mois pour ce lieu.`}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
