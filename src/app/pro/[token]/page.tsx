import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingForProfessional } from "@/lib/booking-pro";
import { SLOT_PERIOD_LABELS } from "@/lib/booking-requests";
import { formatFrenchDate } from "@/lib/french-dates";
import { ProfessionalAnswerForm } from "@/components/ProfessionalAnswerForm";
import { CARD_CLASS, PAGE_TITLE_CLASS, SECTION_TITLE_CLASS } from "@/components/ui";

// Public, capability-token page for the professional (spec "The professional's
// answer"), on the model of src/app/go/[logId]: no session is read, the token is the
// capability, 404 for an unknown or expired one, never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_LABELS: Record<string, string> = {
  brand: "Marque",
  model: "Modèle",
  year: "Année",
  lastService: "Dernier entretien",
  fuel: "Énergie",
  applianceKind: "Type d'appareil",
  flueCount: "Nombre de conduits",
};

export default async function ProfessionalBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) notFound();
  const view = await getBookingForProfessional(token);
  if (!view) notFound();

  const details = Object.entries(view.details ?? {}).filter(([, v]) => v) as [string, string][];

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pt-5 pb-10 sm:pt-8">
        <div>
          <p className="text-sm text-ink-2">Electro Care · pour {view.providerName}</p>
          <h1 className={PAGE_TITLE_CLASS}>{view.kind === "quote" ? "Demande de devis" : "Demande de rendez-vous"}</h1>
          <p className="mt-1 text-sm text-ink-2">Reçue le {formatFrenchDate(view.createdAt)}</p>
        </div>

        <section className={CARD_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Prestation</h2>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {view.items.map((item, i) => (
              <li key={i}>
                {item.taskTitle} <span className="text-ink-2">· {item.applianceLabel}</span>
              </li>
            ))}
          </ul>
          {details.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {details.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-2">{DETAIL_LABELS[key] ?? key}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className={CARD_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Le client</h2>
          <p className="text-sm text-ink">{view.address}</p>
          <p className="text-sm text-ink">{view.phone}</p>
          <p className="text-sm text-ink-2">
            Demi-journées souhaitées : {view.slots.map((s) => `${formatFrenchDate(s.date)} ${SLOT_PERIOD_LABELS[s.period]}`).join(", ")}
          </p>
          {view.comment && <p className="text-sm text-ink-2">« {view.comment} »</p>}
        </section>

        <ProfessionalAnswerForm token={token} view={view} />
      </main>
    </div>
  );
}
