import Link from "next/link";
import { PROPERTY_TYPE_LABELS, type Place } from "@/lib/place-types";
import type { ObligationCounts } from "@/lib/obligations";
import { Icon, IconTile, SegmentedBar } from "@/components/ui";

// Dashboard "one card per place": name, property type and its mini compliance bar —
// nothing else. Tapping it opens the place page with obligations, this month's
// maintenance and its appliances.
export function PlaceCard({
  place,
  counts,
  maintenanceDueCount,
}: {
  place: Place;
  counts: ObligationCounts;
  maintenanceDueCount: number;
}) {
  const nothingToShow = counts.overdue + counts.toConfirm + counts.upToDate === 0 && maintenanceDueCount === 0;
  const detail = !place.onboardedAt
    ? "Compléter le questionnaire"
    : place.propertyType
      ? PROPERTY_TYPE_LABELS[place.propertyType]
      : [place.postcode, place.commune].filter(Boolean).join(" ") || null;

  return (
    <Link
      href={place.onboardedAt ? `/places/${place.id}` : `/places/${place.id}/questionnaire`}
      className="flex flex-col gap-3.5 rounded-[20px] bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <IconTile name="home" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-base font-semibold text-ink">{place.name}</h3>
          {detail && (
            <p className={`text-sm ${place.onboardedAt ? "text-ink-2" : "font-semibold text-accent"}`}>{detail}</p>
          )}
        </div>
        <span className="text-ink-2">
          <Icon name="next" size={20} strokeWidth={2} />
        </span>
      </div>
      <SegmentedBar counts={counts} thin />
      {maintenanceDueCount > 0 && (
        <p className="text-sm text-ink-2">
          {maintenanceDueCount} geste{maintenanceDueCount > 1 ? "s" : ""} d&apos;entretien ce mois-ci
        </p>
      )}
      {nothingToShow && <p className="text-sm text-ink-2">Rien à signaler</p>}
    </Link>
  );
}
