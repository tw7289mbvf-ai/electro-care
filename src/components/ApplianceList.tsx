import Link from "next/link";
import type { Appliance } from "@/lib/appliance-types";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getApplianceIconName } from "@/lib/appliance-icons";
import { Icon } from "@/components/ui";

// Place page "Appareils" (docs/design.md, page du lieu): one tile per appliance, its
// icon over its name, three to a row on a phone. Each tile opens the fiche, where the
// appliance is edited or deleted.
export function ApplianceList({ appliances }: { appliances: Appliance[] }) {
  if (appliances.length === 0) {
    return (
      <p className="rounded-2xl border-[1.5px] border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
        Aucun appareil pour l&apos;instant.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {appliances.map((appliance) => (
        <li key={appliance.id}>
          <Link
            href={`/appliances/${appliance.id}`}
            className="flex h-full min-h-11 flex-col items-center gap-2 rounded-2xl bg-surface px-1.5 py-3.5 text-center text-[13px] font-semibold text-ink"
          >
            <span className="text-accent">
              <Icon name={getApplianceIconName(appliance)} size={26} strokeWidth={1.6} />
            </span>
            <span className="line-clamp-3 break-words">{getApplianceDisplayName(appliance)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
