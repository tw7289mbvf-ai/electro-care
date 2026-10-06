import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { currentMonthKey, addMonthsToKey } from "@/lib/french-dates";
import { getAuthedContext } from "@/lib/db";
import {
  countObligationsByStatus,
  getObligationsForAppliance,
  type ApplianceObligationRecord,
  type ObligationCounts,
} from "@/lib/obligations";

// Neon Auth's session payload includes the admin plugin's `role` field at runtime, but
// the SDK's TypeScript types don't model it (they're generic over which plugins the
// hosted instance has enabled) — hence the narrow cast here instead of trusting `any`.
type SessionUserWithRole = { id: string; role?: string | null };

// "Admin" means exactly one thing everywhere in this app: the `role` column Neon Auth
// manages on neon_auth.user, set once via `neonctl neon-auth user set-role`. No id is
// hardcoded here, in the route handlers, or in scripts/migrate.mjs's SQL functions.
async function getAdminAccountId(): Promise<string | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user as SessionUserWithRole | undefined;
  if (!user || user.role !== "admin") return null;
  return user.id;
}

// For the /admin page (a Server Component): renders nothing and answers 404 for any
// non-admin session, without revealing the page exists.
export async function requireAdminPage(): Promise<string> {
  const accountId = await getAdminAccountId();
  if (!accountId) notFound();
  return accountId;
}

// For admin action route handlers: same check, but returns null instead of throwing
// notFound() (which only works inside rendered Server Component/Action boundaries) so
// the caller can return a plain 404 Response.
export async function requireAdminRoute(): Promise<string | null> {
  return getAdminAccountId();
}

type NeonAuthUser = {
  id: string;
  email: string;
  createdAt: string | Date;
  banned?: boolean | null;
  role?: string | null;
};

export type AdminAccount = {
  id: string;
  email: string;
  createdAt: string;
  banned: boolean;
  placesCount: number;
  appliancesCount: number;
  lastSeenAt: string | null;
};

export type AdminStats = {
  accountsTotal: number;
  accountsNew7d: number;
  accountsActive30d: number;
  placesTotal: number;
  appliancesTotal: number;
  questionnairesCompleted: number;
};

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

// Neon Auth's admin/list-users has no "created in the last N days" filter, so the 7-day
// figure is computed over this same fetched page. 500 comfortably covers this app's
// current scale (MVP, a handful of testers); it would need real pagination well before
// account counts make that assumption wrong.
const ADMIN_ACCOUNT_FETCH_LIMIT = 500;

async function fetchNeonAuthUsers(): Promise<{ users: NeonAuthUser[]; total: number }> {
  const { data, error } = await auth.admin.listUsers({
    query: { limit: ADMIN_ACCOUNT_FETCH_LIMIT, sortBy: "createdAt", sortDirection: "desc" },
  });
  if (error || !data) {
    throw new Error(`Neon Auth: impossible de lister les comptes (${error?.message ?? "réponse vide"})`);
  }
  // The cron account (chantier "rappels par e-mail") is a robot account, not a real
  // user or the admin checking the product — it must never appear in these figures.
  // The admin's own account is deliberately left in, exactly as it already was.
  const users = (data.users as NeonAuthUser[]).filter((u) => u.role !== "cron");
  const total = (data.total ?? data.users.length) - (data.users.length - users.length);
  return { users, total };
}

type StatsRow = {
  accounts_active_30d: string | number;
  places_total: string | number;
  appliances_total: string | number;
  questionnaires_completed: string | number;
};

type CountsRow = { account_id: string; places_count: string | number; appliances_count: string | number };
type ActivityRow = { account_id: string; last_seen_at: string | Date };

export async function getAdminOverview(): Promise<{ stats: AdminStats; accounts: AdminAccount[] }> {
  const { sql } = await getAuthedContext();
  const [{ users, total }, statsRowsRaw, countsRowsRaw, activityRowsRaw] = await Promise.all([
    fetchNeonAuthUsers(),
    sql`SELECT * FROM admin_stats()`,
    sql`SELECT * FROM admin_account_counts()`,
    sql`SELECT * FROM admin_account_activity()`,
  ]);
  const statsRows = statsRowsRaw as StatsRow[];
  const countsRows = countsRowsRaw as CountsRow[];
  const activityRows = activityRowsRaw as ActivityRow[];

  const counts = new Map(countsRows.map((r) => [r.account_id, r]));
  const activity = new Map(activityRows.map((r) => [r.account_id, toIso(r.last_seen_at)]));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const accounts: AdminAccount[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: toIso(u.createdAt),
    banned: Boolean(u.banned),
    placesCount: Number(counts.get(u.id)?.places_count ?? 0),
    appliancesCount: Number(counts.get(u.id)?.appliances_count ?? 0),
    lastSeenAt: activity.get(u.id) ?? null,
  }));

  const statsRow = statsRows[0];
  const stats: AdminStats = {
    accountsTotal: total,
    accountsNew7d: users.filter((u) => new Date(toIso(u.createdAt)).getTime() > sevenDaysAgo).length,
    accountsActive30d: Number(statsRow?.accounts_active_30d ?? 0),
    placesTotal: Number(statsRow?.places_total ?? 0),
    appliancesTotal: Number(statsRow?.appliances_total ?? 0),
    questionnairesCompleted: Number(statsRow?.questionnaires_completed ?? 0),
  };

  return { stats, accounts };
}

export async function getAdminObligationCounts(): Promise<ObligationCounts> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM admin_obligation_rows()`) as {
    appliance_id: string;
    equipment_type_id: string;
    power_kw: string | number | null;
    maintenance_task_id: string | null;
    last_service_date: string | Date | null;
    known_due_date: string | Date | null;
    service_confidence: string | null;
  }[];

  const byAppliance = new Map<string, { equipmentTypeId: string; powerKw: number | null; records: ApplianceObligationRecord[] }>();
  for (const row of rows) {
    const entry = byAppliance.get(row.appliance_id) ?? {
      equipmentTypeId: row.equipment_type_id,
      powerKw: row.power_kw === null ? null : Number(row.power_kw),
      records: [],
    };
    if (row.maintenance_task_id) {
      entry.records.push({
        applianceId: row.appliance_id,
        maintenanceTaskId: row.maintenance_task_id,
        lastServiceDate: row.last_service_date === null ? null : toIso(row.last_service_date).slice(0, 10),
        knownDueDate: row.known_due_date === null ? null : toIso(row.known_due_date).slice(0, 10),
        serviceConfidence: row.service_confidence as ApplianceObligationRecord["serviceConfidence"],
        // admin_obligation_rows() never selects these (spec: provider contact details are
        // never visible in admin) — hardcoded null rather than optional, so this stays
        // true even if ObligationView's shape changes later.
        providerName: null,
        providerContact: null,
        modifiedAt: null,
      });
    }
    byAppliance.set(row.appliance_id, entry);
  }

  const totals: ObligationCounts = { overdue: 0, toConfirm: 0, upToDate: 0 };
  for (const { equipmentTypeId, powerKw, records } of byAppliance.values()) {
    const c = countObligationsByStatus(getObligationsForAppliance(equipmentTypeId, records, powerKw));
    totals.overdue += c.overdue;
    totals.toConfirm += c.toConfirm;
    totals.upToDate += c.upToDate;
  }
  return totals;
}

// One month of activity. overdueResolved is null before STATUS_EVENTS_SINCE_MONTH:
// status changes weren't recorded yet, so "0" would be a false reading.
export type MonthlyActivity = {
  month: string;
  interventions: number;
  maintenanceDone: number;
  overdueResolved: number | null;
};

// obligation_status_changed events exist since 2026-10-05 (spec, "Monthly activity").
const STATUS_EVENTS_SINCE_MONTH = "2026-10";
const ACTIVITY_MONTHS = 12;

export type AdminAccountCompliance = {
  id: string;
  email: string;
  createdAt: string;
  placesCount: number;
  counts: ObligationCounts;
  // Oldest first, last ACTIVITY_MONTHS months, the current one last.
  activity: MonthlyActivity[];
};

type ActivityRowRaw = {
  account_id: string;
  month: string;
  interventions: string | number;
  maintenance_done: string | number;
  overdue_resolved: string | number;
};

function emptyActivity(): MonthlyActivity[] {
  const current = currentMonthKey();
  return Array.from({ length: ACTIVITY_MONTHS }, (_, i) => {
    const month = addMonthsToKey(current, i - (ACTIVITY_MONTHS - 1));
    return {
      month,
      interventions: 0,
      maintenanceDone: 0,
      overdueResolved: month >= STATUS_EVENTS_SINCE_MONTH ? 0 : null,
    };
  });
}

function addActivity(target: MonthlyActivity[], row: ActivityRowRaw): void {
  const slot = target.find((m) => m.month === row.month);
  if (!slot) return;
  slot.interventions += Number(row.interventions);
  slot.maintenanceDone += Number(row.maintenance_done);
  if (slot.overdueResolved !== null) slot.overdueResolved += Number(row.overdue_resolved);
}

type ComplianceRow = {
  account_id: string;
  places_count: string | number;
  appliance_id: string | null;
  equipment_type_id: string | null;
  power_kw: string | number | null;
  maintenance_task_id: string | null;
  last_service_date: string | Date | null;
  known_due_date: string | Date | null;
  service_confidence: string | null;
};

// "Conformité par compte" (spec, "Compliance per account, for support"). The raw rows
// (equipment type, power, task, dates) stay in this function: only per-account counts
// leave it, and they're never logged anywhere. The database returns account ids only;
// the email and sign-up date come from `accounts` (the Neon Auth list) and are attached
// to the final counts just before display. Each call is written to admin_actions first,
// with no target, so a viewing that fails halfway is still journaled.
// Monthly activity comes from admin_monthly_activity(), already aggregated per account
// and month in the database; the global chart is the sum of the same rows, so the two
// views can never disagree.
export async function getAdminComplianceByAccount(
  accounts: AdminAccount[]
): Promise<{ rows: AdminAccountCompliance[]; globalActivity: MonthlyActivity[] }> {
  await logAdminAction("view_compliance", null);
  const { sql } = await getAuthedContext();
  const [rowsRaw, activityRaw] = await Promise.all([
    sql`SELECT * FROM admin_account_compliance_rows()`,
    sql`SELECT * FROM admin_monthly_activity()`,
  ]);
  const rows = rowsRaw as ComplianceRow[];
  const activityRows = activityRaw as ActivityRowRaw[];

  const globalActivity = emptyActivity();
  const activityByAccount = new Map<string, MonthlyActivity[]>();
  for (const row of activityRows) {
    addActivity(globalActivity, row);
    const own = activityByAccount.get(row.account_id) ?? emptyActivity();
    addActivity(own, row);
    activityByAccount.set(row.account_id, own);
  }

  const byAccount = new Map<
    string,
    {
      placesCount: number;
      appliances: Map<string, { equipmentTypeId: string; powerKw: number | null; records: ApplianceObligationRecord[] }>;
    }
  >();
  for (const row of rows) {
    const account = byAccount.get(row.account_id) ?? { placesCount: Number(row.places_count), appliances: new Map() };
    byAccount.set(row.account_id, account);
    if (!row.appliance_id || !row.equipment_type_id) continue;
    const appliance = account.appliances.get(row.appliance_id) ?? {
      equipmentTypeId: row.equipment_type_id,
      powerKw: row.power_kw === null ? null : Number(row.power_kw),
      records: [],
    };
    account.appliances.set(row.appliance_id, appliance);
    if (row.maintenance_task_id) {
      appliance.records.push({
        applianceId: row.appliance_id,
        maintenanceTaskId: row.maintenance_task_id,
        lastServiceDate: row.last_service_date === null ? null : toIso(row.last_service_date).slice(0, 10),
        knownDueDate: row.known_due_date === null ? null : toIso(row.known_due_date).slice(0, 10),
        serviceConfidence: row.service_confidence as ApplianceObligationRecord["serviceConfidence"],
        providerName: null,
        providerContact: null,
        modifiedAt: null,
      });
    }
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const result: AdminAccountCompliance[] = [];
  for (const [accountId, { placesCount, appliances }] of byAccount) {
    const account = accountById.get(accountId);
    if (!account) continue;
    const counts: ObligationCounts = { overdue: 0, toConfirm: 0, upToDate: 0 };
    for (const { equipmentTypeId, powerKw, records } of appliances.values()) {
      const c = countObligationsByStatus(getObligationsForAppliance(equipmentTypeId, records, powerKw));
      counts.overdue += c.overdue;
      counts.toConfirm += c.toConfirm;
      counts.upToDate += c.upToDate;
    }
    result.push({
      id: accountId,
      email: account.email,
      createdAt: account.createdAt,
      placesCount,
      counts,
      activity: activityByAccount.get(accountId) ?? emptyActivity(),
    });
  }
  return { rows: result.sort((a, b) => b.counts.overdue - a.counts.overdue), globalActivity };
}

export type AdminActionEntry = {
  id: string;
  action: "suspend" | "reactivate" | "delete" | "send_reset_link" | "view_compliance";
  targetAccountId: string | null;
  targetEmail: string | null;
  createdAt: string;
};

export async function getAdminActionLog(accounts: AdminAccount[]): Promise<AdminActionEntry[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM admin_list_actions()`) as {
    id: string;
    action: string;
    target_account_id: string | null;
    created_at: string | Date;
  }[];
  const emailByAccount = new Map(accounts.map((a) => [a.id, a.email]));
  return rows.map((r) => ({
    id: r.id,
    action: r.action as AdminActionEntry["action"],
    targetAccountId: r.target_account_id,
    // Resolved from the live account list, never stored: a deleted account's row is
    // gone from admin_actions too (ON DELETE CASCADE), so there is nothing stale to
    // resolve incorrectly — only a currently-existing target ever gets an email here.
    targetEmail: r.target_account_id ? emailByAccount.get(r.target_account_id) ?? null : null,
    createdAt: toIso(r.created_at),
  }));
}

async function logAdminAction(action: AdminActionEntry["action"], targetAccountId: string | null): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_log_action(${action}, ${targetAccountId})`;
}

export async function suspendAccount(accountId: string): Promise<void> {
  const { error } = await auth.admin.banUser({ userId: accountId });
  if (error) throw new Error(`Neon Auth: suspension impossible (${error.message})`);
  await logAdminAction("suspend", accountId);
}

export async function reactivateAccount(accountId: string): Promise<void> {
  const { error } = await auth.admin.unbanUser({ userId: accountId });
  if (error) throw new Error(`Neon Auth: réactivation impossible (${error.message})`);
  await logAdminAction("reactivate", accountId);
}

export async function deleteAccountAsAdmin(accountId: string): Promise<void> {
  // Logged before the actual delete: admin_actions.target_account_id cascades on
  // delete, so the row this writes is removed the instant neon_auth.user is — by
  // design (see scripts/migrate.mjs), not a race to win.
  await logAdminAction("delete", accountId);
  const { error } = await auth.admin.removeUser({ userId: accountId });
  if (error) throw new Error(`Neon Auth: suppression impossible (${error.message})`);
}

export type AdminRequest = {
  id: string;
  accountId: string;
  kind: "deletion" | "contact";
  email: string;
  message: string | null;
  handledAt: string | null;
  createdAt: string;
};

export async function getAdminRequests(): Promise<AdminRequest[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM admin_list_requests()`) as {
    id: string;
    account_id: string;
    kind: string;
    email: string;
    message: string | null;
    handled_at: string | Date | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    kind: r.kind as AdminRequest["kind"],
    email: r.email,
    message: r.message,
    handledAt: r.handled_at === null ? null : toIso(r.handled_at),
    createdAt: toIso(r.created_at),
  }));
}

export async function markRequestHandled(requestId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`SELECT admin_mark_request_handled(${requestId})`;
}

// Reminder-email preview (spec: built but switched off until the Brevo domain/account
// exist — "l'admin peut prévisualiser chaque e-mail dans /admin, sans l'envoyer").
// admin_list_recent_reminder_logs() itself only ever returns admin/test accounts'
// rows — real accounts' content never reaches here, independently of whether sending
// is on (see scripts/migrate.mjs).
export type AdminReminderLogPreview = {
  id: string;
  accountId: string;
  sentDate: string;
  subject: string;
  htmlBody: string;
  actuallySent: boolean;
  createdAt: string;
};

export async function getAdminRecentReminderLogs(): Promise<AdminReminderLogPreview[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM admin_list_recent_reminder_logs()`) as {
    id: string;
    account_id: string;
    sent_date: string | Date;
    subject: string;
    html_body: string;
    actually_sent: boolean;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    sentDate: toIso(r.sent_date).slice(0, 10),
    subject: r.subject,
    htmlBody: r.html_body,
    actuallySent: r.actually_sent,
    createdAt: toIso(r.created_at),
  }));
}

export async function sendPasswordResetLink(accountId: string): Promise<void> {
  const { data, error } = await auth.admin.listUsers({
    query: { limit: 1, filterField: "id", filterOperator: "eq", filterValue: accountId },
  });
  const target = (data?.users as NeonAuthUser[] | undefined)?.[0];
  if (error || !target) throw new Error("Neon Auth: compte introuvable");
  const { error: resetError } = await auth.requestPasswordReset({ email: target.email });
  if (resetError) throw new Error(`Neon Auth: envoi du lien impossible (${resetError.message})`);
  // detail stays empty: the journal records account ids, never emails (see
  // scripts/migrate.mjs, admin_actions) — the UI resolves target_account_id to an
  // email at display time from the live account list, never from a stored value.
  await logAdminAction("send_reset_link", accountId);
}
