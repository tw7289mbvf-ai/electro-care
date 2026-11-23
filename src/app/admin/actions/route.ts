import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminRoute,
  suspendAccount,
  reactivateAccount,
  deleteAccountAsAdmin,
  sendPasswordResetLink,
  markRequestHandled,
} from "@/lib/admin";
import {
  addBookingRecipient,
  closeBookingRequestAsAdmin,
  getBookingRecipientToken,
  recordBookingAnswerAsAdmin,
  saveProfessional,
  setProfessionalActive,
  type AdminProfessionalInput,
} from "@/lib/booking-admin";

const ACTIONS = [
  "suspend",
  "reactivate",
  "delete",
  "reset-link",
  "mark-request-handled",
  // Professionals directory and booking queue (spec "Booking Requests"); each one is a
  // SECURITY DEFINER function gated on _require_admin() that journals itself.
  "save-professional",
  "set-professional-active",
  "booking-link",
  "booking-answer",
  "booking-add-recipient",
  "booking-close",
] as const;
const BOOKING_ANSWERS = ["confirm", "propose", "quote", "decline"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

// Unlike a Server Action, this Route Handler has no built-in CSRF protection from
// Next.js — the Origin check below is what stands in for it. Only POST is exported (no
// GET), and every failure path answers the same 404 as a non-admin session would, so a
// mismatched origin never reveals more than "not found".
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(null, { status: 404 });
  }

  const adminAccountId = await requireAdminRoute();
  if (!adminAccountId) {
    return NextResponse.json(null, { status: 404 });
  }

  let body: {
    action?: unknown;
    accountId?: unknown;
    requestId?: unknown;
    recipientId?: unknown;
    professionalId?: unknown;
    replaceRecipientId?: unknown;
    professional?: unknown;
    active?: unknown;
    answer?: unknown;
    payload?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { action, accountId, requestId } = body;
  if (!isAction(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }

  const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;
  if (action.startsWith("booking-") || action.endsWith("professional") || action === "set-professional-active") {
    try {
      if (action === "save-professional") {
        if (typeof body.professional !== "object" || body.professional === null) {
          return NextResponse.json({ error: "Professionnel invalide." }, { status: 400 });
        }
        const id = await saveProfessional(body.professional as AdminProfessionalInput);
        return NextResponse.json({ ok: true, id });
      }
      if (action === "set-professional-active") {
        if (!isId(body.professionalId) || typeof body.active !== "boolean") {
          return NextResponse.json({ error: "Professionnel invalide." }, { status: 400 });
        }
        await setProfessionalActive(body.professionalId, body.active);
      } else if (action === "booking-link") {
        if (!isId(body.recipientId)) return NextResponse.json({ error: "Destinataire invalide." }, { status: 400 });
        const token = await getBookingRecipientToken(body.recipientId);
        return NextResponse.json({ ok: true, url: `${request.nextUrl.origin}/pro/${token}` });
      } else if (action === "booking-answer") {
        const answer = body.answer;
        if (!isId(body.recipientId) || typeof answer !== "string" || !(BOOKING_ANSWERS as readonly string[]).includes(answer)) {
          return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
        }
        const payload = typeof body.payload === "object" && body.payload !== null ? (body.payload as Record<string, unknown>) : {};
        await recordBookingAnswerAsAdmin(body.recipientId, answer as (typeof BOOKING_ANSWERS)[number], payload);
      } else if (action === "booking-add-recipient") {
        if (!isId(requestId) || !isId(body.professionalId)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
        await addBookingRecipient(requestId, body.professionalId, isId(body.replaceRecipientId) ? body.replaceRecipientId : null);
      } else if (action === "booking-close") {
        if (!isId(requestId)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
        await closeBookingRequestAsAdmin(requestId);
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur inconnue." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mark-request-handled") {
    if (typeof requestId !== "string" || !requestId) {
      return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    }
    try {
      await markRequestHandled(requestId);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur inconnue." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Compte invalide." }, { status: 400 });
  }
  if (accountId === adminAccountId) {
    return NextResponse.json({ error: "Action impossible sur votre propre compte." }, { status: 400 });
  }

  try {
    if (action === "suspend") await suspendAccount(accountId);
    else if (action === "reactivate") await reactivateAccount(accountId);
    else if (action === "delete") await deleteAccountAsAdmin(accountId);
    else await sendPasswordResetLink(accountId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur inconnue." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
