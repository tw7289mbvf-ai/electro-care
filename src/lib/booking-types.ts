import { getTodayInFrance } from "@/lib/obligations";
import { isPastBusinessDays } from "@/lib/business-days";
import type { BookingTrade } from "@/lib/maintenance-tasks";

// Types, labels and pure helpers of spec "Booking Requests", shared by server code
// (src/lib/booking-requests.ts) and client components — this file never touches the
// database, so a client bundle can import it.
export type BookingKind = "appointment" | "quote";
export type BookingRequestStatus = "sent" | "confirmed" | "cancelled" | "closed";
export type BookingRecipientStatus = "pending" | "confirmed" | "proposed" | "quoted" | "declined" | "not_chosen" | "replaced";
export type SlotPeriod = "morning" | "afternoon";
export type BookingSlot = { date: string; period: SlotPeriod };

export const SLOT_PERIOD_LABELS: Record<SlotPeriod, string> = { morning: "matin", afternoon: "après-midi" };
export const NO_ANSWER_BUSINESS_DAYS = 3;

// Prefilled from the appliance card, every field optional ("Je ne sais pas" = null).
export type BookingDetails = {
  brand: string | null;
  model: string | null;
  year: string | null;
  lastService: string | null;
  fuel: string | null;
  applianceKind: string | null;
  flueCount: string | null;
};

export type BookingRecipient = {
  id: string;
  professionalId: string | null;
  providerName: string;
  providerCity: string | null;
  status: BookingRecipientStatus;
  priceEur: number | null;
  proposedDate: string | null;
  proposedTime: string | null;
  answerNote: string | null;
  answeredAt: string | null;
};

export type BookingRequestItem = {
  applianceId: string;
  maintenanceTaskId: string;
  taskTitle: string;
  applianceLabel: string;
};

export type BookingRequest = {
  id: string;
  placeId: string;
  kind: BookingKind;
  trade: BookingTrade;
  status: BookingRequestStatus;
  firstAvailable: boolean;
  phone: string;
  address: string;
  slots: BookingSlot[];
  comment: string | null;
  details: BookingDetails;
  createdAt: string;
  closedAt: string | null;
  items: BookingRequestItem[];
  recipients: BookingRecipient[];
};

// list_bookable_professionals(): what a user may see of the directory.
export type BookableProfessional = { id: string; name: string; city: string | null; prices: Record<string, number> };

// What an obligation row shows while a request is open (spec "Statuses").
export type BookingRequestSummary = {
  requestId: string;
  applianceId: string;
  maintenanceTaskId: string;
  kind: BookingKind;
  label: string;
  tone: "accent" | "warn" | "late";
};

export function emptyDetails(): BookingDetails {
  return { brand: null, model: null, year: null, lastService: null, fuel: null, applianceKind: null, flueCount: null };
}

// Recipients still able to answer, and those who did.
export function liveRecipients(request: BookingRequest): BookingRecipient[] {
  return request.recipients.filter((r) => r.status !== "replaced");
}
export function answeredRecipients(request: BookingRequest): BookingRecipient[] {
  return liveRecipients(request).filter((r) => r.status === "quoted" || r.status === "proposed" || r.status === "confirmed");
}
export function allDeclined(request: BookingRequest): boolean {
  const live = liveRecipients(request);
  return live.length > 0 && live.every((r) => r.status === "declined");
}
export function isWaitingTooLong(request: BookingRequest, todayIso: string = getTodayInFrance()): boolean {
  return (
    request.status === "sent" &&
    answeredRecipients(request).length === 0 &&
    !allDeclined(request) &&
    isPastBusinessDays(request.createdAt, NO_ANSWER_BUSINESS_DAYS, todayIso)
  );
}

// spec "Statuses": "Demande envoyée"; for a quote "Devis reçus" with the count; a
// decline or three working days without an answer is shown too. Confirmed requests
// have their obligation_appointments row and need no chip of their own.
export function summarizeOpenRequests(requests: BookingRequest[]): BookingRequestSummary[] {
  const today = getTodayInFrance();
  return requests
    .filter((r) => r.status === "sent")
    .flatMap((r) => {
      const live = liveRecipients(r);
      const answered = answeredRecipients(r);
      let label = "Demande envoyée";
      let tone: BookingRequestSummary["tone"] = "accent";
      if (allDeclined(r)) {
        label = live.length > 1 ? "Demande refusée par les professionnels" : "Demande refusée";
        tone = "late";
      } else if (r.kind === "quote" && answered.length > 0) {
        label = `Devis reçus : ${answered.length} sur ${live.length}`;
      } else if (r.kind === "appointment" && answered.length > 0) {
        label = "Autre date proposée";
        tone = "warn";
      } else if (isWaitingTooLong(r, today)) {
        label = "Sans réponse depuis 3 jours ouvrés";
        tone = "warn";
      }
      return r.items.map((i) => ({
        requestId: r.id,
        applianceId: i.applianceId,
        maintenanceTaskId: i.maintenanceTaskId,
        kind: r.kind,
        label,
        tone,
      }));
    });
}
