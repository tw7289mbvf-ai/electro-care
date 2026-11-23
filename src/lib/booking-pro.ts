import { getCronContext } from "@/lib/cron-auth";
import type { BookingDetails, BookingKind, BookingRecipientStatus, BookingRequestStatus, BookingSlot } from "@/lib/booking-types";

// The professional's personal link (spec "The professional's answer"): no account, the
// unguessable token is the capability, 30 days, and the SQL functions only ever return
// this recipient's own view — never the other recipients. Same connection as
// src/app/go/[logId] (src/lib/cron-auth.ts explains why it is the `cron` account).
export type ProBookingView = {
  recipientStatus: BookingRecipientStatus;
  providerName: string;
  priceEur: number | null;
  proposedDate: string | null;
  proposedTime: string | null;
  requestStatus: BookingRequestStatus;
  kind: BookingKind;
  trade: string;
  address: string;
  phone: string;
  slots: BookingSlot[];
  comment: string | null;
  details: Partial<BookingDetails>;
  createdAt: string;
  items: { taskTitle: string; applianceLabel: string }[];
};

export type ProAnswerAction = "confirm" | "propose" | "quote" | "decline";

export async function getBookingForProfessional(token: string): Promise<ProBookingView | null> {
  const { sql } = await getCronContext();
  const [row] = (await sql`SELECT pro_get_booking(${token}) AS view`) as { view: (Omit<ProBookingView, "priceEur"> & { priceEur: string | number | null }) | null }[];
  if (!row?.view) return null;
  return { ...row.view, priceEur: row.view.priceEur === null ? null : Number(row.view.priceEur) };
}

export async function answerBookingAsProfessional(token: string, action: ProAnswerAction, payload: Record<string, unknown>): Promise<boolean> {
  const { sql } = await getCronContext();
  const [row] = (await sql`SELECT pro_answer_booking(${token}, ${action}, ${JSON.stringify(payload)}::jsonb) AS ok`) as { ok: boolean }[];
  return row?.ok ?? false;
}
