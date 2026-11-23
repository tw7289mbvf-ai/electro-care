import Link from "next/link";
import type { BookingRequestSummary } from "@/lib/booking-types";
import { BUTTON_PRIMARY, Pill } from "@/components/ui";

// spec "Booking Requests": "Prendre rendez-vous" on every legal obligation whose task has
// a booking trade, whatever its status; while a request is open the row shows its
// status instead and links to the request (place page and appliance fiche).
export function BookingRequestButton({
  placeId,
  applianceId,
  maintenanceTaskId,
  summary,
}: {
  placeId: string;
  applianceId: string;
  maintenanceTaskId: string;
  summary: BookingRequestSummary | null;
}) {
  if (summary) {
    return (
      <Link href={`/requests/${summary.requestId}`} className="inline-flex min-h-11 items-center">
        <Pill tone={summary.tone}>{summary.label} →</Pill>
      </Link>
    );
  }
  return (
    <Link href={`/places/${placeId}/booking/new?appliance=${applianceId}&task=${maintenanceTaskId}`} className={BUTTON_PRIMARY}>
      Prendre rendez-vous
    </Link>
  );
}
