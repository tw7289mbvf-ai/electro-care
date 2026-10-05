import { getAuthedContext } from "@/lib/db";

export type SatisfactionResponse = "very_disappointed" | "somewhat_disappointed" | "not_disappointed";

export type AccountPreferences = {
  emailRemindersEnabled: boolean;
  unsubscribeToken: string;
  satisfactionResponse: SatisfactionResponse | null;
  satisfactionComment: string | null;
  satisfactionShownAt: string | null;
};

type PreferencesRow = {
  email_reminders_enabled: boolean;
  unsubscribe_token: string;
  satisfaction_response: SatisfactionResponse | null;
  satisfaction_comment: string | null;
  satisfaction_shown_at: string | Date | null;
};

function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toPreferences(row: PreferencesRow): AccountPreferences {
  return {
    emailRemindersEnabled: row.email_reminders_enabled,
    unsubscribeToken: row.unsubscribe_token,
    satisfactionResponse: row.satisfaction_response,
    satisfactionComment: row.satisfaction_comment,
    satisfactionShownAt: toIsoOrNull(row.satisfaction_shown_at),
  };
}

// Lazily creates the row on first read (spec's "on by default" — a row doesn't need to
// exist yet for that default to hold; see cron_due_reminders's COALESCE too).
export async function getAccountPreferences(): Promise<AccountPreferences> {
  const { sql, accountId } = await getAuthedContext();
  const rows = (await sql`
    INSERT INTO account_preferences (account_id) VALUES (${accountId})
    ON CONFLICT (account_id) DO NOTHING
    RETURNING email_reminders_enabled, unsubscribe_token, satisfaction_response, satisfaction_comment, satisfaction_shown_at
  `) as PreferencesRow[];
  if (rows[0]) return toPreferences(rows[0]);
  const existing = (await sql`
    SELECT email_reminders_enabled, unsubscribe_token, satisfaction_response, satisfaction_comment, satisfaction_shown_at
    FROM account_preferences WHERE account_id = ${accountId}
  `) as PreferencesRow[];
  return toPreferences(existing[0]);
}

export async function setEmailRemindersEnabled(enabled: boolean): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  await sql`
    INSERT INTO account_preferences (account_id, email_reminders_enabled) VALUES (${accountId}, ${enabled})
    ON CONFLICT (account_id) DO UPDATE SET email_reminders_enabled = EXCLUDED.email_reminders_enabled
  `;
}

// Shown once, ever, regardless of whether the account answers — marked at display
// time, not at response time, matching the spec's "shown once".
export function shouldShowSatisfactionSurvey(accountCreatedAt: string, shownAt: string | null): boolean {
  if (shownAt) return false;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(accountCreatedAt).getTime() <= thirtyDaysAgo;
}

// Render-time read: a preferences failure must not break the page showing them. Null
// means "unknown" — callers fall back to the defaults and show no survey.
export async function getAccountPreferencesOrNull(): Promise<AccountPreferences | null> {
  try {
    return await getAccountPreferences();
  } catch (error) {
    console.error("account preferences unavailable", error);
    return null;
  }
}

// Called at render time (the home page), so it never throws: a failed mark is logged
// and the page still renders.
export async function markSatisfactionSurveyShown(): Promise<void> {
  try {
    const { sql, accountId } = await getAuthedContext();
    await sql`
      INSERT INTO account_preferences (account_id, satisfaction_shown_at) VALUES (${accountId}, now())
      ON CONFLICT (account_id) DO UPDATE SET
        satisfaction_shown_at = COALESCE(account_preferences.satisfaction_shown_at, now())
    `;
  } catch (error) {
    console.error("satisfaction survey not marked as shown", error);
  }
}

export async function recordSatisfactionResponse(response: SatisfactionResponse, comment: string | null): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  await sql`
    INSERT INTO account_preferences (account_id, satisfaction_response, satisfaction_comment, satisfaction_shown_at)
    VALUES (${accountId}, ${response}, ${comment}, now())
    ON CONFLICT (account_id) DO UPDATE SET
      satisfaction_response = EXCLUDED.satisfaction_response,
      satisfaction_comment = EXCLUDED.satisfaction_comment,
      satisfaction_shown_at = COALESCE(account_preferences.satisfaction_shown_at, now())
  `;
}
