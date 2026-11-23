"use server";

import { revalidatePath } from "next/cache";
import { answerBookingAsProfessional, type ProAnswerAction } from "@/lib/booking-pro";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: readonly ProAnswerAction[] = ["confirm", "propose", "quote", "decline"];

// Called from the professional's page: the token in the URL is the only credential.
export async function submitProfessionalAnswer(
  token: string,
  action: string,
  payload: Record<string, unknown>
): Promise<{ error?: string }> {
  if (!UUID_PATTERN.test(token) || !(ACTIONS as readonly string[]).includes(action)) return { error: "Lien invalide." };
  try {
    const ok = await answerBookingAsProfessional(token, action as ProAnswerAction, payload);
    if (!ok) return { error: "Ce lien a expiré." };
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.includes("request closed")) return { error: "Cette demande est close." };
    if (message.includes("recipient closed")) return { error: "Cette demande a été attribuée à un autre professionnel." };
    console.error("pro_answer_booking failed", error);
    return { error: "Votre réponse n'a pas pu être enregistrée." };
  }
  revalidatePath(`/pro/${token}`);
  return {};
}
