import type { Milestone } from "@/lib/reminder-milestones";

// The email body embeds fields the account typed in themselves (brand, model, place
// address, provider name) — this is not a fixed template with no user input, so every
// such field is escaped here before it ever reaches an <a>/<p>. The admin preview also
// renders this HTML inside a sandboxed iframe (defense in depth, not a substitute).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asEmailOrNull(value: string | null): string | null {
  return value && EMAIL_PATTERN.test(value) ? value : null;
}

export type ReminderObligationInput = {
  applianceId: string;
  maintenanceTaskId: string;
  placeName: string;
  placeAddress: string | null;
  equipmentLabel: string;
  brand: string | null;
  model: string | null;
  taskTitle: string;
  legalBasis: string | null;
  providerContact: string | null;
  dueDate: string;
  milestone: Milestone;
};

// One entry of reminder_logs.payload — only what /go/[logId] needs to render the
// "ready-to-send" request or redirect to the fiche. Snapshotted at send time so that
// page never re-queries appliances/places (see the chantier's "capability-token links"
// design: the UUID is the capability, not a session).
export type ReminderPayloadEntry = {
  applianceId: string;
  equipmentLabel: string;
  brand: string | null;
  model: string | null;
  taskTitle: string;
  legalBasis: string | null;
  placeAddress: string | null;
  providerEmail: string | null;
};

export function buildReminderPayload(obligations: ReminderObligationInput[]): ReminderPayloadEntry[] {
  return obligations.map((o) => ({
    applianceId: o.applianceId,
    equipmentLabel: o.equipmentLabel,
    brand: o.brand,
    model: o.model,
    taskTitle: o.taskTitle,
    legalBasis: o.legalBasis,
    placeAddress: o.placeAddress,
    providerEmail: asEmailOrNull(o.providerContact),
  }));
}

const MILESTONE_FRAMING: Record<Milestone, string> = {
  three_months: "Échéance dans 3 mois",
  one_month: "Échéance dans 1 mois",
  due_date: "Échéance aujourd'hui",
  overdue_1: "En retard",
  overdue_2: "En retard",
  overdue_3: "En retard",
};

function applianceLabel(o: { equipmentLabel: string; brand: string | null; model: string | null }): string {
  const parts = [o.equipmentLabel];
  if (o.brand) parts.push(o.brand);
  if (o.model) parts.push(o.model);
  return escapeHtml(parts.join(" "));
}

export function buildReminderEmail(
  logId: string,
  appUrl: string,
  unsubscribeToken: string,
  obligations: ReminderObligationInput[]
): { subject: string; html: string } {
  const subject =
    obligations.length === 1
      ? `Entretien à prévoir : ${applianceLabel(obligations[0]).replace(/<[^>]+>/g, "")}`
      : `${obligations.length} entretiens à prévoir`;

  const rows = obligations
    .map((o, index) => {
      const goBase = `${appUrl}/go/${logId}?i=${index}`;
      const missingBrandModel = !o.brand || !o.model;
      return `
        <div style="margin:0 0 20px 0;padding:16px;border:1px solid #e4e4e7;border-radius:8px;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#059669;text-transform:uppercase;">
            ${escapeHtml(MILESTONE_FRAMING[o.milestone])}
          </p>
          <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:#18181b;">
            ${escapeHtml(o.taskTitle)} — ${applianceLabel(o)}
          </p>
          ${o.legalBasis ? `<p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">${escapeHtml(o.legalBasis)}</p>` : ""}
          ${
            o.placeAddress
              ? `<p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">${escapeHtml(o.placeName)} — ${escapeHtml(o.placeAddress)}</p>`
              : `<p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">${escapeHtml(o.placeName)}</p>`
          }
          ${
            missingBrandModel
              ? `<p style="margin:0 0 8px 0;font-size:13px;color:#b45309;">
                   Ajoutez la marque et le modèle : votre demande sera plus précise, et le professionnel
                   pourra prévoir les bonnes pièces.
                   <a href="${goBase}&to=fiche" style="color:#b45309;">Compléter la fiche</a>
                 </p>`
              : ""
          }
          <p style="margin:8px 0 0 0;">
            <a href="${goBase}&to=quote" style="display:inline-block;margin-right:8px;padding:8px 14px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;">
              Demander un devis
            </a>
            <a href="${goBase}&to=intervention" style="display:inline-block;padding:8px 14px;background:#f4f4f5;color:#18181b;text-decoration:none;border-radius:6px;font-size:13px;">
              Demander une intervention
            </a>
          </p>
        </div>`;
    })
    .join("");

  const unsubscribeUrl = `${appUrl}/api/unsubscribe/${unsubscribeToken}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
      <h1 style="font-size:18px;margin:0 0 16px 0;">Electro Care — vos rappels d'entretien</h1>
      ${rows}
      <p style="margin:24px 0 0 0;font-size:11px;color:#a1a1aa;">
        <a href="${unsubscribeUrl}" style="color:#a1a1aa;">Désactiver les rappels par e-mail</a>
      </p>
    </div>`;

  return { subject, html };
}

export type RequestMailtoKind = "quote" | "intervention";

export function buildRequestMailto(
  kind: RequestMailtoKind,
  entry: ReminderPayloadEntry
): { to: string | null; subject: string; body: string } {
  const applianceDescription = [entry.equipmentLabel, entry.brand, entry.model].filter(Boolean).join(" ");
  const subject = kind === "quote" ? `Demande de devis — ${entry.taskTitle}` : `Demande d'intervention — ${entry.taskTitle}`;
  const lines = [
    kind === "quote"
      ? `Bonjour,\n\nJe souhaite recevoir un devis pour l'intervention suivante :`
      : `Bonjour,\n\nJe souhaite programmer l'intervention suivante :`,
    `- Appareil : ${applianceDescription}`,
    `- Intervention : ${entry.taskTitle}`,
    entry.legalBasis ? `- Base légale : ${entry.legalBasis}` : null,
    entry.placeAddress ? `- Adresse : ${entry.placeAddress}` : null,
    `\nMerci d'avance,`,
  ].filter((line): line is string => line !== null);
  return { to: entry.providerEmail, subject, body: lines.join("\n") };
}
