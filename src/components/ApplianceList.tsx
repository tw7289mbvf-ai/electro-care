import { CATEGORIES, CATEGORY_LABELS, type Appliance, type Category } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { DeleteApplianceButton } from "@/components/DeleteApplianceButton";

const BADGE_COLORS = [
  "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
];

const CATEGORY_STYLES: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((category, i) => [category, BADGE_COLORS[i % BADGE_COLORS.length]])
);

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApplianceList({ appliances }: { appliances: Appliance[] }) {
  if (appliances.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Aucun appareil pour l&apos;instant. Ajoutez le premier ci-dessus.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {appliances.map((appliance) => {
        const subtitle = [appliance.brand, appliance.model].filter(Boolean).join(" · ");
        return (
          <li
            key={appliance.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {getApplianceDisplayName(appliance)}
              </p>
              {subtitle && (
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
              )}
              <span
                className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[appliance.category]}`}
              >
                {CATEGORY_LABELS[appliance.category]}
              </span>
              {appliance.purchaseDate && (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Acheté le {formatDate(appliance.purchaseDate)}
                </p>
              )}
            </div>
            <DeleteApplianceButton id={appliance.id} />
          </li>
        );
      })}
    </ul>
  );
}
