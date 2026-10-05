import { getAuthedContext } from "@/lib/db";

// "Measuring the MVP" (spec): the six measurable indicators (the seventh, business
// model, is tracked by hand) plus the multi-home breakdown added for this chantier.
// Every underlying SQL function excludes role IN ('admin', 'test', 'cron') from both
// numerator and denominator — see scripts/migrate.mjs's admin_kpi_counts/
// admin_account_engagement.

export type KpiIndicator = {
  key: string;
  label: string;
  // null when the denominator is zero — "pas encore de donnée" rather than a
  // misleading 0%.
  ratio: number | null;
  detail: string;
};

type KpiCountsRow = {
  accounts_total: string | number;
  accounts_questionnaire_completed: string | number;
  accounts_engaged_30d: string | number;
  accounts_eligible_for_retention: string | number;
  accounts_retained_second_month: string | number;
  reminders_sent: string | number;
  reminders_followed_by_action_30d: string | number;
  obligations_overdue_resolved_60d: string | number;
  obligations_overdue_more_than_60d: string | number;
  survey_responses_total: string | number;
  survey_very_disappointed: string | number;
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export async function getKpiIndicators(): Promise<KpiIndicator[]> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT * FROM admin_kpi_counts()`) as KpiCountsRow[];
  const n = (v: string | number) => Number(v);

  return [
    {
      key: "activation",
      label: "Activation",
      ratio: ratio(n(row.accounts_questionnaire_completed), n(row.accounts_total)),
      detail: `${row.accounts_questionnaire_completed} / ${row.accounts_total} comptes ont terminé le questionnaire`,
    },
    {
      key: "engagement",
      label: "Engagement",
      ratio: ratio(n(row.accounts_engaged_30d), n(row.accounts_total)),
      detail: `${row.accounts_engaged_30d} / ${row.accounts_total} comptes ont un « C'est fait » ou un rendez-vous sous 30 jours`,
    },
    {
      key: "retention",
      label: "Rétention",
      ratio: ratio(n(row.accounts_retained_second_month), n(row.accounts_eligible_for_retention)),
      detail: `${row.accounts_retained_second_month} / ${row.accounts_eligible_for_retention} comptes (≥ 60 jours) revenus après le premier mois — approximation (dernière visite connue uniquement)`,
    },
    {
      key: "reminder_effect",
      label: "Effet des rappels",
      ratio: ratio(n(row.reminders_followed_by_action_30d), n(row.reminders_sent)),
      detail: `${row.reminders_followed_by_action_30d} / ${row.reminders_sent} rappels suivis d'une action sous 30 jours`,
    },
    {
      key: "promise_kept",
      label: "Promesse tenue",
      ratio: ratio(
        n(row.obligations_overdue_resolved_60d),
        n(row.obligations_overdue_resolved_60d) + n(row.obligations_overdue_more_than_60d)
      ),
      detail: `${row.obligations_overdue_resolved_60d} obligations rouges devenues vertes sous 60 jours, ${row.obligations_overdue_more_than_60d} toujours rouges après 60 jours — approximation`,
    },
    {
      key: "attachment",
      label: "Attachement",
      ratio: ratio(n(row.survey_very_disappointed), n(row.survey_responses_total)),
      detail: `${row.survey_very_disappointed} / ${row.survey_responses_total} réponses « très déçu »`,
    },
  ];
}

export type MultiHomeBucket = { label: string; accounts: number; engagedAccounts: number };

type EngagementRow = { account_id: string; places_count: string | number; engaged: boolean };

function bucketLabel(placesCount: number): string {
  if (placesCount === 1) return "1 logement";
  if (placesCount === 2) return "2 logements";
  if (placesCount === 3) return "3 logements";
  return "Plus de 3 logements";
}

export async function getMultiHomeBreakdown(): Promise<MultiHomeBucket[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`SELECT * FROM admin_account_engagement()`) as EngagementRow[];
  const buckets = new Map<string, MultiHomeBucket>();
  for (const label of ["1 logement", "2 logements", "3 logements", "Plus de 3 logements"]) {
    buckets.set(label, { label, accounts: 0, engagedAccounts: 0 });
  }
  for (const row of rows) {
    const label = bucketLabel(Number(row.places_count));
    const bucket = buckets.get(label)!;
    bucket.accounts += 1;
    if (row.engaged) bucket.engagedAccounts += 1;
  }
  return Array.from(buckets.values());
}
