"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlace, updatePlace } from "@/lib/places";
import {
  cancelBookingRequest,
  chooseBookingAnswer,
  createBookingRequest,
  getBookingRequest,
  type BookingDetails,
  type BookingKind,
  type BookingRecipientInput,
  type BookingRequestItem,
  type BookingSlot,
} from "@/lib/booking-requests";
import { isBookingTrade } from "@/lib/maintenance-tasks";

// spec "Booking Requests": the form's submit. Everything the owner's grants can't check
// (place ownership, offered professionals, open duplicates) is checked again inside
// create_booking_request(); this action only shapes the payload and maps its errors to
// a French sentence.
export type BookingFormPayload = {
  placeId: string;
  kind: BookingKind;
  trade: string;
  firstAvailable: boolean;
  phone: string;
  comment: string;
  slots: BookingSlot[];
  details: BookingDetails;
  items: BookingRequestItem[];
  recipients: BookingRecipientInput[];
  consent: boolean;
  // Asked in the form only when the place has no address yet; saved on the place.
  streetAddress?: string;
  addressComplement?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function submitBookingRequest(payload: BookingFormPayload): Promise<{ error?: string }> {
  if (!isBookingTrade(payload.trade)) return { error: "Métier inconnu." };
  if (payload.kind !== "appointment" && payload.kind !== "quote") return { error: "Type de demande inconnu." };
  if (!payload.phone.trim()) return { error: "Le téléphone est obligatoire." };
  if (!payload.consent) return { error: "Votre accord est nécessaire pour transmettre la demande." };
  const slots = payload.slots.filter((s) => s.date && DATE_PATTERN.test(s.date));
  if (slots.length < 2 || slots.length > 3) return { error: "Indiquez deux ou trois demi-journées." };
  if (payload.items.length === 0) return { error: "Aucune obligation sélectionnée." };
  if (payload.kind === "appointment" && !payload.firstAvailable && payload.recipients.length !== 1) {
    return { error: "Choisissez un professionnel, ou « Le premier disponible »." };
  }
  if (payload.kind === "quote" && (payload.recipients.length < 1 || payload.recipients.length > 3)) {
    return { error: "Choisissez un à trois professionnels." };
  }

  const place = await getPlace(payload.placeId);
  if (!place) return { error: "Lieu introuvable." };
  if (!place.streetAddress) {
    const street = payload.streetAddress?.trim() ?? "";
    if (!street) return { error: "L'adresse du lieu est nécessaire pour la demande." };
    await updatePlace(place.id, {
      name: place.name,
      commune: place.commune,
      postcode: place.postcode,
      streetAddress: street,
      addressComplement: payload.addressComplement?.trim() || null,
      propertyType: place.propertyType,
    });
  }

  let requestId: string;
  try {
    requestId = await createBookingRequest({
      placeId: place.id,
      kind: payload.kind,
      trade: payload.trade,
      firstAvailable: payload.kind === "appointment" && payload.firstAvailable,
      phone: payload.phone.trim(),
      comment: payload.comment.trim() || null,
      slots,
      details: payload.details,
      items: payload.items,
      recipients: payload.kind === "appointment" && payload.firstAvailable ? [] : payload.recipients,
      consent: true,
    });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.includes("already requested")) return { error: "Une demande est déjà en cours pour cette obligation." };
    if (message.includes("professional not offered")) return { error: "Un des professionnels choisis n'est plus proposé." };
    console.error("create_booking_request failed", error);
    return { error: "La demande n'a pas pu être envoyée." };
  }
  revalidatePath("/");
  revalidatePath(`/places/${place.id}`);
  for (const item of payload.items) revalidatePath(`/appliances/${item.applianceId}`);
  redirect(`/requests/${requestId}`);
}

async function revalidateRequestPages(requestId: string): Promise<void> {
  const request = await getBookingRequest(requestId);
  revalidatePath("/");
  revalidatePath(`/requests/${requestId}`);
  if (request) {
    revalidatePath(`/places/${request.placeId}`);
    for (const item of request.items) revalidatePath(`/appliances/${item.applianceId}`);
  }
}

// "Choisir" on an answer (spec "Statuses"): creates the "Rendez-vous pris" rows.
export async function chooseBookingAnswerAction(requestId: string, recipientId: string): Promise<{ error?: string }> {
  try {
    await chooseBookingAnswer(recipientId);
  } catch (error) {
    console.error("choose_booking_answer failed", error);
    return { error: "Ce choix n'a pas pu être enregistré." };
  }
  await revalidateRequestPages(requestId);
  return {};
}

export async function cancelBookingRequestAction(requestId: string): Promise<{ error?: string }> {
  try {
    await cancelBookingRequest(requestId);
  } catch (error) {
    console.error("cancel_booking_request failed", error);
    return { error: "La demande n'a pas pu être annulée." };
  }
  await revalidateRequestPages(requestId);
  return {};
}
