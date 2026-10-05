"use client";

import { useState } from "react";
import type { AdminReminderLogPreview } from "@/lib/admin";

// Renders the stored HTML inside a sandboxed iframe with no `allow-scripts` — never
// dangerouslySetInnerHTML. The email body embeds fields the account typed themselves
// (brand, model, address, provider name); those are escaped when the email is built
// (src/lib/email/reminder-email.ts), and this sandbox is the second, independent layer
// in case escaping were ever missed somewhere.
export function ReminderLogPreviewRow({ log }: { log: AdminReminderLogPreview }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{log.subject}</span>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {log.sentDate} · {log.actuallySent ? "envoyé" : "aperçu (envoi coupé)"}
        </span>
      </button>
      {expanded && (
        <iframe
          sandbox=""
          srcDoc={log.htmlBody}
          className="mt-3 h-96 w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      )}
    </li>
  );
}
