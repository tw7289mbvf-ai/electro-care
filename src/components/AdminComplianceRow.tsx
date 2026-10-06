"use client";

import { Fragment, useState } from "react";
import type { ObligationCounts } from "@/lib/obligations";
import type { MonthlyActivity } from "@/lib/admin";
import { SegmentedBar } from "@/components/ui";
import { ActivityTable } from "@/components/AdminActivityChart";

// One line of "Conformité par compte": counts only (no appliance or place detail ever
// reaches the browser). A click expands the account's last twelve months.
export function AdminComplianceRow({
  email,
  formattedCreatedAt,
  placesCount,
  counts,
  activity,
}: {
  email: string;
  formattedCreatedAt: string;
  placesCount: number;
  counts: ObligationCounts;
  activity: MonthlyActivity[];
}) {
  const [open, setOpen] = useState(false);
  const current = activity[activity.length - 1];

  return (
    <Fragment>
      <tr onClick={() => setOpen((v) => !v)} className="cursor-pointer hover:bg-surface-2">
        <td className="px-4 py-2 text-ink">
          <button
            type="button"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 text-left hover:underline"
          >
            <span aria-hidden="true">{open ? "▾" : "▸"}</span>
            {email}
          </button>
        </td>
        <td className="px-4 py-2 text-ink-2">{formattedCreatedAt}</td>
        <td className="px-4 py-2 text-ink-2">{placesCount}</td>
        <td className="px-4 py-2 text-ink-2">{counts.overdue}</td>
        <td className="px-4 py-2 text-ink-2">{counts.toConfirm}</td>
        <td className="px-4 py-2 text-ink-2">{counts.upToDate}</td>
        <td className="px-4 py-2">
          <SegmentedBar counts={counts} thin />
        </td>
        <td className="px-4 py-2 text-ink-2">{current.interventions}</td>
        <td className="px-4 py-2 text-ink-2">{current.maintenanceDone}</td>
        <td className="px-4 py-2 text-ink-2">{current.overdueResolved ?? "—"}</td>
      </tr>
      {open && (
        <tr className="bg-surface-2">
          <td colSpan={10} className="px-4 py-3">
            <p className="mb-2 text-[13px] font-medium text-ink">Activité des 12 derniers mois</p>
            <ActivityTable activity={[...activity].reverse()} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
