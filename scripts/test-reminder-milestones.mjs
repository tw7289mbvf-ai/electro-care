#!/usr/bin/env node
// Pure-logic sanity check for the reminder schedule (chooseMilestoneToSend) — no DB,
// no Neon. Run with: node --experimental-strip-types scripts/test-reminder-milestones.mjs
import { register } from "node:module";
register("./_ts_alias_loader.mjs", import.meta.url);

const { chooseMilestoneToSend } = await import("@/lib/reminder-milestones");

const results = [];
function check(label, condition, detail) {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? "OK  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
}

// A 3-month gap in cron runs (three_months and one_month both passed unnoticed): only
// the most recent eligible milestone is sent, never a burst of several.
{
  const { toSend, toMarkSent } = chooseMilestoneToSend("2026-10-01", [], "2026-10-05");
  check("missed-day gap sends exactly one milestone", toSend === "due_date", toSend);
  check(
    "missed-day gap still marks every skipped-over milestone handled",
    toMarkSent.length === 3 && toMarkSent.includes("three_months") && toMarkSent.includes("one_month"),
    JSON.stringify(toMarkSent)
  );
}

// Nothing eligible yet (today is well before the first milestone).
{
  const { toSend } = chooseMilestoneToSend("2026-10-01", [], "2026-01-01");
  check("nothing eligible before the first milestone", toSend === null, toSend);
}

// Already handled: once every milestone up to today has been marked sent, nothing is
// eligible again until the next one's own trigger date arrives.
{
  const { toSend } = chooseMilestoneToSend("2026-10-01", ["three_months", "one_month", "due_date"], "2026-10-05");
  check("no milestone left to send once all past ones are marked sent", toSend === null, toSend);
}

// Overdue follow-ups stop after the third one.
{
  const { toSend } = chooseMilestoneToSend(
    "2026-10-01",
    ["three_months", "one_month", "due_date", "overdue_1", "overdue_2", "overdue_3"],
    "2027-06-01"
  );
  check("automated reminders stop after overdue_3", toSend === null, toSend);
}

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length > 0) process.exit(1);
