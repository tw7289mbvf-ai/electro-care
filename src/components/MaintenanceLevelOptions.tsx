import {
  MAINTENANCE_LEVELS,
  MAINTENANCE_LEVEL_LABELS,
  MAINTENANCE_LEVEL_DESCRIPTIONS,
  type MaintenanceLevel,
} from "@/lib/maintenance-levels";
import { formatDuration } from "@/lib/durations";

const OPTION_CLASS =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-[15px] text-ink hover:border-accent has-[:checked]:border-accent";

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
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="font-semibold">{MAINTENANCE_LEVEL_LABELS[level]}</span>
            <span className="mt-0.5 block text-sm text-ink-2">
              {MAINTENANCE_LEVEL_DESCRIPTIONS[level]}
              {level !== "none" && ` Environ ${formatDuration(estimates[level])} par mois pour ce lieu.`}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
