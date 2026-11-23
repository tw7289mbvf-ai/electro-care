import { getAuthedContext } from "@/lib/db";
import type { BookingTrade } from "@/lib/maintenance-tasks";
import {
  emptyDetails,
  type BookableProfessional,
  type BookingDetails,
  type BookingKind,
  type BookingRecipient,
  type BookingRecipientStatus,
  type BookingRequest,
  type BookingRequestItem,
  type BookingRequestStatus,
  type BookingSlot,
} from "@/lib/booking-types";

export * from "@/lib/booking-types";

// spec "Booking Requests", step 1 (concierge). The owner reads their requests through
// RLS (SELECT only); every write is a SECURITY DEFINER function in scripts/migrate.mjs
// (create_booking_request, choose_booking_answer, cancel_booking_request), because a
// write has to read the professionals directory or create "Rendez-vous pris" rows.
type RequestRow = {
  id: string;
  place_id: string;
  kind: string;
  trade: string;
  status: string;
  first_available: boolean;
  phone: string;
  address: string;
  slots: BookingSlot[];
  comment: string | null;
  details: Partial<BookingDetails> | null;
  created_at: string | Date;
  closed_at: string | Date | null;
};
type ItemRow = { request_id: string; appliance_id: string; maintenance_task_id: string; task_title: string; appliance_label: string };
type RecipientRow = {
  id: string;
  request_id: string;
  professional_id: string | null;
  provider_name: string;
  provider_city: string | null;
  status: string;
  price_eur: string | number | null;
  proposed_date: string | Date | null;
  proposed_time: string | null;
  answer_note: string | null;
  answered_at: string | Date | null;
};

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}
function toIsoOrNull(value: string | Date | null): string | null {
  return value === null ? null : toIso(value);
}
function toDateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function toNumberOrNull(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function toRecipient(r: RecipientRow): BookingRecipient {
  return {
    id: r.id,
    professionalId: r.professional_id,
    providerName: r.provider_name,
    providerCity: r.provider_city,
    status: r.status as BookingRecipientStatus,
    priceEur: toNumberOrNull(r.price_eur),
    proposedDate: toDateOnly(r.proposed_date),
    proposedTime: r.proposed_time,
    answerNote: r.answer_note,
    answeredAt: toIsoOrNull(r.answered_at),
  };
}

function assemble(rows: RequestRow[], items: ItemRow[], recipients: RecipientRow[]): BookingRequest[] {
  return rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    kind: r.kind as BookingKind,
    trade: r.trade as BookingTrade,
    status: r.status as BookingRequestStatus,
    firstAvailable: r.first_available,
    phone: r.phone,
    address: r.address,
    slots: r.slots,
    comment: r.comment,
    details: { ...emptyDetails(), ...(r.details ?? {}) },
    createdAt: toIso(r.created_at),
    closedAt: toIsoOrNull(r.closed_at),
    items: items
      .filter((i) => i.request_id === r.id)
      .map((i) => ({ applianceId: i.appliance_id, maintenanceTaskId: i.maintenance_task_id, taskTitle: i.task_title, applianceLabel: i.appliance_label })),
    recipients: recipients.filter((x) => x.request_id === r.id).map(toRecipient),
  }));
}

async function loadRequests(where: { placeId?: string; applianceId?: string; id?: string }): Promise<BookingRequest[]> {
  const { sql } = await getAuthedContext();
  let rows: RequestRow[];
  if (where.id) {
    rows = (await sql`SELECT * FROM booking_requests WHERE id = ${where.id}`) as RequestRow[];
  } else if (where.applianceId) {
    rows = (await sql`
      SELECT DISTINCT r.* FROM booking_requests r
      JOIN booking_request_items i ON i.request_id = r.id
      WHERE i.appliance_id = ${where.applianceId}
    `) as RequestRow[];
  } else {
    rows = (await sql`SELECT * FROM booking_requests WHERE place_id = ${where.placeId!} ORDER BY created_at DESC`) as RequestRow[];
  }
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const items = (await sql`SELECT * FROM booking_request_items WHERE request_id = ANY(${ids}::uuid[])`) as ItemRow[];
  const recipients = (await sql`
    SELECT * FROM booking_request_recipients WHERE request_id = ANY(${ids}::uuid[]) ORDER BY created_at
  `) as RecipientRow[];
  return assemble(rows, items, recipients);
}

export async function getBookingRequest(id: string): Promise<BookingRequest | null> {
  const [request] = await loadRequests({ id });
  return request ?? null;
}

export async function getBookingRequestsForPlace(placeId: string): Promise<BookingRequest[]> {
  return loadRequests({ placeId });
}

export async function getBookingRequestsForAppliance(applianceId: string): Promise<BookingRequest[]> {
  return loadRequests({ applianceId });
}

// "repris de la dernière demande": the owner's most recent phone number.
export async function getLastBookingPhone(): Promise<string | null> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT phone FROM booking_requests ORDER BY created_at DESC LIMIT 1`) as { phone: string }[];
  return row?.phone ?? null;
}

// list_bookable_professionals(): name, city and prices only — never the rating, the
// notes or the status (spec "Professionals directory").
export async function listBookableProfessionals(trade: BookingTrade, postcode: string, taskIds: string[]): Promise<BookableProfessional[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM list_bookable_professionals(${trade}, ${postcode}, ${taskIds}::text[])`) as {
    id: string;
    name: string;
    city: string | null;
    prices: Record<string, string | number>;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    prices: Object.fromEntries(Object.entries(r.prices ?? {}).map(([k, v]) => [k, Number(v)])),
  }));
}

export type BookingRecipientInput = { professionalId: string } | { providerName: string; providerContact: string | null };

export type CreateBookingRequestInput = {
  placeId: string;
  kind: BookingKind;
  trade: BookingTrade;
  firstAvailable: boolean;
  phone: string;
  comment: string | null;
  slots: BookingSlot[];
  details: BookingDetails;
  items: BookingRequestItem[];
  recipients: BookingRecipientInput[];
  consent: boolean;
};

export async function createBookingRequest(input: CreateBookingRequestInput): Promise<string> {
  const { sql } = await getAuthedContext();
  const payload = {
    place_id: input.placeId,
    kind: input.kind,
    trade: input.trade,
    first_available: input.firstAvailable,
    phone: input.phone,
    comment: input.comment,
    slots: input.slots,
    details: input.details,
    consent: input.consent,
    items: input.items.map((i) => ({
      appliance_id: i.applianceId,
      maintenance_task_id: i.maintenanceTaskId,
      task_title: i.taskTitle,
      appliance_label: i.applianceLabel,
    })),
    recipients: input.recipients.map((r) =>
      "professionalId" in r ? { professional_id: r.professionalId } : { provider_name: r.providerName, provider_contact: r.providerContact }
    ),
  };
  const [row] = (await sql`SELECT create_booking_request(${JSON.stringify(payload)}::jsonb) AS id`) as { id: string }[];
  return row.id;
}

export async function chooseBookingAnswer(recipientId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT choose_booking_answer(${recipientId})`;
}

export async function cancelBookingRequest(requestId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT cancel_booking_request(${requestId})`;
}
