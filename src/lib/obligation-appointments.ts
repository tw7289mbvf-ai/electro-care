import { getAuthedContext } from "@/lib/db";

// "Rendez-vous pris" (spec's "Managing Appliances"): a single pending appointment per
// (appliance, task) — a plan, not a proof, so unlike obligation_completions it has no
// history and is simply replaced (reschedule) or removed (cancel, or resolved into a
// completion once the visit happened).
export type ObligationAppointment = {
  applianceId: string;
  maintenanceTaskId: string;
  appointmentDate: string;
  providerName: string;
  providerContact: string | null;
};

type AppointmentRow = {
  appliance_id: string;
  maintenance_task_id: string;
  appointment_date: string | Date;
  provider_name: string;
  provider_contact: string | null;
};

function toDateOnly(value: string | Date): string {
  if (typeof value === "string") return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toAppointment(row: AppointmentRow): ObligationAppointment {
  return {
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    appointmentDate: toDateOnly(row.appointment_date),
    providerName: row.provider_name,
    providerContact: row.provider_contact,
  };
}

export async function getAppointmentsForPlace(placeId: string): Promise<ObligationAppointment[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT oa.appliance_id, oa.maintenance_task_id, oa.appointment_date, oa.provider_name, oa.provider_contact
    FROM obligation_appointments oa
    JOIN appliances a ON a.id = oa.appliance_id
    WHERE a.place_id = ${placeId}
  `) as AppointmentRow[];
  return rows.map(toAppointment);
}

export async function getAppointmentsForAppliance(applianceId: string): Promise<ObligationAppointment[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, appointment_date, provider_name, provider_contact
    FROM obligation_appointments
    WHERE appliance_id = ${applianceId}
  `) as AppointmentRow[];
  return rows.map(toAppointment);
}

// "Rendez-vous pris" and "Reprogrammer" both replace whatever appointment already
// exists for this task, rather than accumulating one — there is only ever one plan.
export async function setObligationAppointment(input: {
  applianceId: string;
  maintenanceTaskId: string;
  appointmentDate: string;
  providerName: string;
  providerContact: string | null;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO obligation_appointments (appliance_id, maintenance_task_id, appointment_date, provider_name, provider_contact)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.appointmentDate}, ${input.providerName}, ${input.providerContact})
    ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
      appointment_date = EXCLUDED.appointment_date,
      provider_name = EXCLUDED.provider_name,
      provider_contact = EXCLUDED.provider_contact
  `;
}

// "Annuler", and the "Oui, le rendez-vous a eu lieu" branch (via markObligationDone,
// which calls this too) — the obligation then returns to its ordinary status.
export async function deleteObligationAppointment(applianceId: string, maintenanceTaskId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    DELETE FROM obligation_appointments WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId}
  `;
}
