import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminRoute,
  suspendAccount,
  reactivateAccount,
  deleteAccountAsAdmin,
  sendPasswordResetLink,
} from "@/lib/admin";

const ACTIONS = ["suspend", "reactivate", "delete", "reset-link"] as const;
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

  let body: { action?: unknown; accountId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { action, accountId } = body;
  if (!isAction(action) || typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Action ou compte invalide." }, { status: 400 });
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
