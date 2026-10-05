import { randomUUID } from "node:crypto";
import { getCronContext } from "@/lib/cron-auth";
import { getObligationsForAppliance, getTodayInFrance, type ApplianceObligationRecord } from "@/lib/obligations";
import { getEquipmentType } from "@/lib/equipment-types";
import { getMaintenanceTask } from "@/lib/maintenance-tasks";
import { getLegalObligationsForType } from "@/lib/legal-obligations";
import { chooseMilestoneToSend, type Milestone } from "@/lib/reminder-milestones";
import { buildReminderEmail, buildReminderPayload, type ReminderObligationInput } from "@/lib/email/reminder-email";
import { sendTransactionalEmail } from "@/lib/email/brevo";

// Vercel Cron, once a day (not guaranteed — see src/lib/reminder-milestones.ts). This
// route is the only caller of the `cron`-role SQL functions in scripts/migrate.mjs.
export const dynamic = "force-dynamic";

type DueRow = {
  account_id: string;
  account_email: string;
  place_id: string;
  place_name: string;
  street_address: string | null;
  address_complement: string | null;
  commune: string | null;
  postcode: string | null;
  appliance_id: string;
  appliance_name: string | null;
  brand: string | null;
  model: string | null;
  equipment_type_id: string;
  power_kw: string | number | null;
  maintenance_task_id: string;
  last_service_date: string | null;
  known_due_date: string | null;
  service_confidence: ApplianceObligationRecord["serviceConfidence"];
  provider_contact: string | null;
  has_pending_appointment: boolean;
  prior_milestones: string[];
  unsubscribe_token: string;
};

function composePlaceAddress(row: DueRow): string | null {
  const line = [row.street_address, row.address_complement].filter(Boolean).join(" ");
  const cityLine = [row.postcode, row.commune].filter(Boolean).join(" ");
  const full = [line, cityLine].filter(Boolean).join(", ");
  return full || null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sendingEnabled = process.env.EMAIL_REMINDERS_SENDING_ENABLED === "true";
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return new Response("APP_URL is not set", { status: 500 });
  }
  const today = getTodayInFrance();

  const { sql } = await getCronContext();
  const rows = (await sql`SELECT * FROM cron_due_reminders(${!sendingEnabled})`) as DueRow[];

  type Chosen = { row: DueRow; dueDate: string; milestone: Milestone; toMarkSent: Milestone[] };
  const chosen: Chosen[] = [];

  for (const row of rows) {
    if (row.has_pending_appointment) continue;
    const record: ApplianceObligationRecord = {
      applianceId: row.appliance_id,
      maintenanceTaskId: row.maintenance_task_id,
      lastServiceDate: row.last_service_date,
      knownDueDate: row.known_due_date,
      serviceConfidence: row.service_confidence,
      providerName: null,
      providerContact: row.provider_contact,
      modifiedAt: null,
    };
    const views = getObligationsForAppliance(
      row.equipment_type_id,
      [record],
      row.power_kw === null ? null : Number(row.power_kw),
      today
    );
    const view = views.find((v) => v.task.id === row.maintenance_task_id);
    if (!view?.dueDate) continue;
    const { toSend, toMarkSent } = chooseMilestoneToSend(view.dueDate, row.prior_milestones, today);
    if (!toSend) continue;
    chosen.push({ row, dueDate: view.dueDate, milestone: toSend, toMarkSent });
  }

  const byAccount = new Map<string, Chosen[]>();
  for (const c of chosen) {
    const list = byAccount.get(c.row.account_id) ?? [];
    list.push(c);
    byAccount.set(c.row.account_id, list);
  }

  for (const [accountId, entries] of byAccount) {
    const obligations: ReminderObligationInput[] = entries.map((c) => ({
      applianceId: c.row.appliance_id,
      maintenanceTaskId: c.row.maintenance_task_id,
      placeName: c.row.place_name,
      placeAddress: composePlaceAddress(c.row),
      equipmentLabel: getEquipmentType(c.row.equipment_type_id)?.label ?? c.row.equipment_type_id,
      brand: c.row.brand,
      model: c.row.model,
      taskTitle: getMaintenanceTask(c.row.maintenance_task_id)?.title ?? c.row.maintenance_task_id,
      // Simplification (noted in the chantier plan): takes the first legal obligation
      // text for the equipment type rather than disambiguating per task — the rest of
      // the app (ObligationRow) doesn't disambiguate either, most equipment types have
      // exactly one.
      legalBasis: getLegalObligationsForType(c.row.equipment_type_id)[0]?.legalText ?? null,
      providerContact: c.row.provider_contact,
      dueDate: c.dueDate,
      milestone: c.milestone,
    }));

    const logId = randomUUID();
    const payload = buildReminderPayload(obligations);
    const { subject, html } = buildReminderEmail(logId, appUrl, entries[0].row.unsubscribe_token, obligations);

    await sql`
      SELECT cron_save_reminder_log(
        ${logId}, ${accountId}, ${today}, ${subject}, ${html}, ${JSON.stringify(payload)}, ${sendingEnabled}
      )
    `;

    if (sendingEnabled) {
      for (const c of entries) {
        await sql`
          SELECT cron_mark_milestones_sent(
            ${c.row.appliance_id}, ${c.row.maintenance_task_id}, ${c.dueDate}, ${c.toMarkSent}, ${logId}
          )
        `;
      }
      await sendTransactionalEmail({ to: entries[0].row.account_email, subject, html });
      await sql`
        INSERT INTO product_events (account_id, event_type, metadata)
        VALUES (${accountId}, 'reminder_sent', ${JSON.stringify({ reminder_log_id: logId })})
      `;
    }
  }

  await sql`SELECT cron_purge_old_reminder_logs()`;

  return Response.json({ accountsNotified: byAccount.size, sendingEnabled });
}
