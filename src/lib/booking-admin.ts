import { getAuthedContext } from "@/lib/db";
import type { BookingTrade } from "@/lib/maintenance-tasks";
import type { BookingDetails, BookingKind, BookingRecipientStatus, BookingRequestStatus, BookingSlot } from "@/lib/booking-types";
import type { ProAnswerAction } from "@/lib/booking-pro";

// Admin side of spec "Booking Requests": the professionals directory and the request
// queue. Every function here is a SECURITY DEFINER function gated on _require_admin()
// in scripts/migrate.mjs, which also writes the admin_actions journal entry itself —
// admin_list_booking_requests() journals each viewing, since it is the one admin read
// that carries an address, a phone number and an appliance.
export type ProfessionalStatus = "non_contacte" | "contacte" | "partenaire" | "refus";
export const PROFESSIONAL_STATUS_LABELS: Record<ProfessionalStatus, string> = {
  non_contacte: "Non contacté",
  contacte: "Contacté",
  partenaire: "Partenaire",
  refus: "Refus",
};

export type AdminProfessional = {
  id: string;
  name: string;
  trades: BookingTrade[];
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  postalCodesCovered: string[];
  status: ProfessionalStatus;
  active: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleCheckedOn: string | null;
  notes: string;
  prices: Record<string, number>;
};

export type AdminProfessionalInput = Omit<AdminProfessional, "id" | "prices"> & { id: string | null; prices: Record<string, number | null> };

export async function getAdminProfessionals(): Promise<AdminProfessional[]> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT admin_list_professionals() AS list`) as { list: (Omit<AdminProfessional, "prices" | "googleRating"> & { prices: Record<string, string | number>; googleRating: string | number | null })[] }[];
  return (row?.list ?? []).map((p) => ({
    ...p,
    googleRating: p.googleRating === null ? null : Number(p.googleRating),
    googleCheckedOn: p.googleCheckedOn ? String(p.googleCheckedOn).slice(0, 10) : null,
    prices: Object.fromEntries(Object.entries(p.prices ?? {}).map(([k, v]) => [k, Number(v)])),
  }));
}

export async function saveProfessional(input: AdminProfessionalInput): Promise<string> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT admin_save_professional(${JSON.stringify(input)}::jsonb) AS id`) as { id: string }[];
  return row.id;
}

export async function setProfessionalActive(id: string, active: boolean): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_set_professional_active(${id}, ${active})`;
}

export type AdminBookingRecipient = {
  id: string;
  professionalId: string | null;
  providerName: string;
  providerCity: string | null;
  providerContact: string | null;
  status: BookingRecipientStatus;
  priceEur: number | null;
  proposedDate: string | null;
  proposedTime: string | null;
  answerNote: string | null;
  answeredAt: string | null;
  answeredBy: "link" | "admin" | null;
  createdAt: string;
};

export type AdminBookingRequest = {
  id: string;
  accountId: string;
  kind: BookingKind;
  trade: BookingTrade;
  status: BookingRequestStatus;
  firstAvailable: boolean;
  phone: string;
  address: string;
  postcode: string | null;
  slots: BookingSlot[];
  comment: string | null;
  details: Partial<BookingDetails>;
  createdAt: string;
  closedAt: string | null;
  items: { taskTitle: string; applianceLabel: string; maintenanceTaskId: string }[];
  recipients: AdminBookingRecipient[];
};

export async function getAdminBookingRequests(): Promise<AdminBookingRequest[]> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT admin_list_booking_requests() AS list`) as {
    list: (Omit<AdminBookingRequest, "recipients"> & { recipients: (Omit<AdminBookingRecipient, "priceEur"> & { priceEur: string | number | null })[] })[];
  }[];
  return (row?.list ?? []).map((r) => ({
    ...r,
    recipients: r.recipients.map((x) => ({
      ...x,
      priceEur: x.priceEur === null ? null : Number(x.priceEur),
      proposedDate: x.proposedDate ? String(x.proposedDate).slice(0, 10) : null,
    })),
  }));
}

export async function getBookingRecipientToken(recipientId: string): Promise<string> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT admin_booking_recipient_link(${recipientId}) AS token`) as { token: string }[];
  return row.token;
}

export async function recordBookingAnswerAsAdmin(recipientId: string, action: ProAnswerAction, payload: Record<string, unknown>): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_record_booking_answer(${recipientId}, ${action}, ${JSON.stringify(payload)}::jsonb)`;
}

export async function addBookingRecipient(requestId: string, professionalId: string, replaceRecipientId: string | null): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_add_booking_recipient(${requestId}, ${professionalId}, ${replaceRecipientId})`;
}

export async function closeBookingRequestAsAdmin(requestId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_close_booking_request(${requestId})`;
}
