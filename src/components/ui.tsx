import Link from "next/link";
import type { ReactNode } from "react";
import type { Appliance } from "@/lib/appliance-types";
import type { ObligationCounts, ObligationStatus } from "@/lib/obligations";
import { OBLIGATION_STATUS_LABELS } from "@/lib/obligations";
import { getApplianceIconName } from "@/lib/appliance-icons";
import { formatDuration } from "@/lib/durations";

// Building blocks of the design charter (docs/design.md, "Composants"). Colours only
// ever come from the theme tokens in globals.css.

// --- Buttons: 44px high, 12px radius ---------------------------------------------

const BUTTON_BASE =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-60";

export const BUTTON_DONE = `${BUTTON_BASE} bg-ok-soft text-ok`;
export const BUTTON_UPDATE = `${BUTTON_BASE} bg-warn-soft text-warn`;
export const BUTTON_DEFER = `${BUTTON_BASE} border-[1.5px] border-warn-border bg-surface text-warn`;
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-accent text-on-accent`;
export const BUTTON_NEUTRAL = `${BUTTON_BASE} bg-surface-2 text-ink`;
// Neutral button sitting on the page background rather than on a card.
export const BUTTON_SURFACE = `${BUTTON_BASE} bg-surface text-ink`;
export const BUTTON_OUTLINE = `${BUTTON_BASE} border-[1.5px] border-line-strong text-ink`;
export const BUTTON_DANGER = `${BUTTON_BASE} bg-late-soft text-late`;
// A text-only action ("Annuler", "Je ne sais pas") that still offers a 44px target.
export const BUTTON_TEXT =
  "inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-60";
export const LINK_TEXT = "font-semibold text-accent underline-offset-2 hover:underline";
// A standalone accent link with a 44px target ("Importer une facture").
export const LINK_ACTION = "inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-semibold text-accent hover:underline";

// --- Surfaces and type -----------------------------------------------------------

export const PAGE_CLASS = "mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-5 pb-10";
export const CARD_CLASS = "flex flex-col gap-3 rounded-[20px] bg-surface p-4";
export const ROW_CLASS = "flex flex-col gap-3 rounded-2xl bg-surface p-3.5";
export const PAGE_TITLE_CLASS = "font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink";
export const SECTION_TITLE_CLASS = "font-display text-[19px] font-semibold text-ink";
export const GROUP_LABEL_CLASS = "px-1 text-[13px] font-semibold text-ink-2";
export const INPUT_CLASS =
  "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-base text-ink outline-none placeholder:text-ink-2 focus:border-accent focus:ring-2 focus:ring-accent/30";

export function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold text-accent">
      <Icon name="back" size={20} strokeWidth={2} />
      {children}
    </Link>
  );
}

// --- Icons: 24×24 strokes, 1.75 wide -------------------------------------------------

const ICON_PATHS = {
  boiler: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M12 8.5c1.6 1.7 2.2 2.9 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.2.6-2.4 2.2-4.1z" />
      <path d="M8.5 18h7" />
    </>
  ),
  fire: <path d="M12 3c3 3.4 5 6.1 5 9.4a5 5 0 0 1-10 0c0-1.9 1-3.5 2.5-4.9.3 1.4 1 2.2 2 2.5C11 7.9 11.2 5.4 12 3z" />,
  cold: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5" />
    </>
  ),
  detector: (
    <>
      <path d="M4 7h16" />
      <path d="M6.5 7a5.5 5.5 0 0 0 11 0" />
      <circle cx="12" cy="9.5" r="1" />
      <path d="M8 17c1.1 1.3 2.5 2 4 2s2.9-.7 4-2" />
    </>
  ),
  water: <path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />,
  washer: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="13" r="4.2" />
      <path d="M7.5 6.5h2" />
    </>
  ),
  fridge: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M6 10h12M9 6v2M9 13v3" />
    </>
  ),
  vehicle: (
    <>
      <path d="M5 16v-5l2-5h10l2 5v5" />
      <path d="M3 16h18" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  cooking: (
    <>
      <path d="M4 10h16" />
      <path d="M5.5 10v6.5A3.5 3.5 0 0 0 9 20h6a3.5 3.5 0 0 0 3.5-3.5V10" />
      <path d="M9.5 3.5v3M14.5 3.5v3" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8z" />
      <path d="M12 16.5V21" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  energy: <path d="M13 3L5.5 13.5h5.5L10 21l7.5-10.5H12L13 3z" />,
  garden: (
    <>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
      <path d="M5 19l7-7" />
    </>
  ),
  ventilation: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 10.5c-.5-2.5.5-4.5 2.5-4.5M13.4 12.6c2.3.8 3.4 2.7 2.4 4.4M10.6 12.6c-1.9 1.6-4.1 1.6-4.9-.2" />
    </>
  ),
  opening: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M12 3v18M5 12h14" />
    </>
  ),
  other: (
    <>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  appointment: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  add: <path d="M12 5v14M5 12h14" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 22, strokeWidth = 1.75 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export type Tone = "late" | "warn" | "ok" | "accent" | "neutral";

const TONE_TILE: Record<Tone, string> = {
  late: "bg-late-soft text-late",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-neutral-soft text-neutral",
};

export function statusTone(status: ObligationStatus): Tone {
  if (status === "overdue") return "late";
  if (status === "to_confirm") return "warn";
  if (status === "up_to_date") return "ok";
  return "neutral";
}

// A rounded square tinted by status: 44px in rows, 64px at the top of a fiche.
export function IconTile({ name, tone = "accent", large = false }: { name: IconName; tone?: Tone; large?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${TONE_TILE[tone]} ${
        large ? "h-16 w-16 rounded-[20px]" : "h-11 w-11 rounded-[14px]"
      }`}
    >
      <Icon name={name} size={large ? 32 : 22} strokeWidth={large ? 1.6 : 1.75} />
    </span>
  );
}

export function ApplianceIconTile({ appliance, tone, large }: { appliance: Appliance; tone?: Tone; large?: boolean }) {
  return <IconTile name={getApplianceIconName(appliance)} tone={tone} large={large} />;
}

// --- Status pills: pale background, dark text ------------------------------------

const TONE_PILL: Record<Tone, string> = TONE_TILE;

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${TONE_PILL[tone]}`}>
      {children}
    </span>
  );
}

export function StatusPill({ status, label }: { status: ObligationStatus; label?: string | null }) {
  return <Pill tone={statusTone(status)}>{label ?? OBLIGATION_STATUS_LABELS[status]}</Pill>;
}

// --- "Ajouter": dashed border, accent text, + icon -------------------------------------

export function AddLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-strong px-4 text-[15px] font-semibold text-accent"
    >
      <Icon name="add" size={20} strokeWidth={2} />
      {children}
    </Link>
  );
}

// --- Compliance bar: segmented, full colours, only place they appear ------------------

export function SegmentedBar({ counts, thin = false }: { counts: ObligationCounts; thin?: boolean }) {
  const segments = [
    { value: counts.overdue, className: "bg-bar-late" },
    { value: counts.toConfirm, className: "bg-bar-warn" },
    { value: counts.upToDate, className: "bg-bar-ok" },
  ].filter((s) => s.value > 0);
  if (segments.length === 0) return null;
  return (
    <div className={`flex ${thin ? "h-1.5 gap-[3px]" : "h-3 gap-1"}`} aria-hidden="true">
      {segments.map((s, i) => (
        <div key={i} className={`rounded-full ${s.className}`} style={{ flex: s.value }} />
      ))}
    </div>
  );
}

export function ComplianceGauge({
  counts,
  maintenanceDueCount,
  maintenanceMinutes,
}: {
  counts: ObligationCounts;
  maintenanceDueCount: number;
  maintenanceMinutes: number;
}) {
  const total = counts.overdue + counts.toConfirm + counts.upToDate;
  if (total === 0 && maintenanceDueCount === 0) return null;

  const legend = [
    { label: `${counts.overdue} en retard`, className: "bg-bar-late" },
    { label: `${counts.toConfirm} à confirmer`, className: "bg-bar-warn" },
    { label: `${counts.upToDate} à jour`, className: "bg-bar-ok" },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface px-5 py-[22px]">
      {total > 0 && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-[44px] font-bold leading-none tracking-[-1px] text-ink">
              {counts.upToDate} sur {total}
            </span>
            <span className="text-[15px] text-ink-2">obligations à jour</span>
          </div>
          <SegmentedBar counts={counts} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${item.className}`} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
        </>
      )}
      {maintenanceDueCount > 0 && (
        <p className={`flex items-center gap-2.5 text-sm text-ink-2 ${total > 0 ? "border-t border-line pt-3.5" : ""}`}>
          <Icon name="time" size={18} />
          {maintenanceDueCount} geste{maintenanceDueCount > 1 ? "s" : ""} d&apos;entretien ce mois-ci
          {maintenanceMinutes > 0 ? `, environ ${formatDuration(maintenanceMinutes)}` : ""}
        </p>
      )}
    </section>
  );
}
