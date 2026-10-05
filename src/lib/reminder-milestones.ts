import { addMonths } from "@/lib/obligations";

// Six milestones per (appliance, task, due_date), in schedule order. The last three are
// the "une relance par mois tant que ça reste en retard, trois au plus" follow-ups —
// automated reminders stop once overdue_3 has fired.
export const MILESTONES = [
  "three_months",
  "one_month",
  "due_date",
  "overdue_1",
  "overdue_2",
  "overdue_3",
] as const;

export type Milestone = (typeof MILESTONES)[number];

const MONTH_OFFSET: Record<Milestone, number> = {
  three_months: -3,
  one_month: -1,
  due_date: 0,
  overdue_1: 1,
  overdue_2: 2,
  overdue_3: 3,
};

export function milestoneTriggerDate(dueDate: string, milestone: Milestone): string {
  return addMonths(dueDate, MONTH_OFFSET[milestone]);
}

// Hobby's daily cron isn't guaranteed to run every day, so a milestone's trigger date
// being "today" can't be the test — a missed run would silently drop that reminder
// forever. Instead: of every milestone whose trigger date has already passed and that
// hasn't been sent yet, send only the most recent one (never a burst of several at
// once), but mark the whole eligible set as handled — an older, skipped milestone must
// never resurface later just because a newer one was chosen instead.
export function chooseMilestoneToSend(
  dueDate: string,
  alreadySent: readonly string[],
  today: string
): { toSend: Milestone | null; toMarkSent: Milestone[] } {
  const sent = new Set(alreadySent);
  const eligible = MILESTONES.filter(
    (m) => !sent.has(m) && milestoneTriggerDate(dueDate, m) <= today
  );
  if (eligible.length === 0) {
    return { toSend: null, toMarkSent: [] };
  }
  // MILESTONES is already in trigger-date order, so the last eligible entry is the
  // most recent one.
  const toSend = eligible[eligible.length - 1];
  return { toSend, toMarkSent: eligible };
}
