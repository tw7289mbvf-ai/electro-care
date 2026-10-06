import { redirect } from "next/navigation";
import { getCronContext } from "@/lib/cron-auth";
import { buildRequestMailto, type ReminderPayloadEntry, type RequestMailtoKind } from "@/lib/email/reminder-email";
import { CopyTextButton } from "@/components/CopyTextButton";

// Public, capability-token page behind every link in a reminder email — the visitor's
// own session (if any) is never checked, only the unguessable logId; see
// src/lib/cron-auth.ts for why this connects as the `cron` account rather than a
// genuinely anonymous one. get_reminder_log_payload/log_reminder_link_click return
// nothing for an unknown id, and this page shows the same "Ce lien a expiré" message,
// whether the id never existed or simply aged out past 90 days.
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ExpiredLink() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-2 px-4 py-14 text-center">
        <p className="text-sm text-ink-2">Ce lien a expiré.</p>
      </main>
    </div>
  );
}

export default async function GoPage({
  params,
  searchParams,
}: {
  params: Promise<{ logId: string }>;
  searchParams: Promise<{ i?: string; to?: string }>;
}) {
  const { logId } = await params;
  const { i, to } = await searchParams;
  const taskIndex = Number(i ?? "0");

  if (!UUID_PATTERN.test(logId) || !Number.isInteger(taskIndex) || taskIndex < 0 || !to) {
    return <ExpiredLink />;
  }

  const { sql } = await getCronContext();
  const [payloadRow] = (await sql`SELECT get_reminder_log_payload(${logId}, ${taskIndex}) AS entry`) as {
    entry: ReminderPayloadEntry | null;
  }[];
  const entry = payloadRow?.entry ?? null;
  if (!entry) {
    return <ExpiredLink />;
  }
  await sql`SELECT log_reminder_link_click(${logId}, ${taskIndex}, ${to})`;

  if (to === "fiche") {
    redirect(`/appliances/${entry.applianceId}`);
  }
  if (to !== "quote" && to !== "intervention") {
    return <ExpiredLink />;
  }

  const mailto = buildRequestMailto(to as RequestMailtoKind, entry);
  const mailtoHref = `mailto:${mailto.to ?? ""}?subject=${encodeURIComponent(mailto.subject)}&body=${encodeURIComponent(mailto.body)}`;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 pt-5 pb-10 sm:pt-8">
        <h1 className="text-xl font-semibold text-ink">
          {to === "quote" ? "Demande de devis" : "Demande d'intervention"}
        </h1>
        {!mailto.to && (
          <p className="text-sm text-warn">
            Aucune adresse de professionnel connue : complétez le destinataire dans votre messagerie.
          </p>
        )}
        <pre className="whitespace-pre-wrap rounded-[20px] bg-surface p-4 text-sm text-ink">
          {mailto.body}
        </pre>
        <div className="flex gap-3">
          <a
            href={mailtoHref}
            className="inline-flex w-fit items-center inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-85"
          >
            Ouvrir dans ma messagerie
          </a>
          <CopyTextButton text={mailto.body} />
        </div>
      </main>
    </div>
  );
}
