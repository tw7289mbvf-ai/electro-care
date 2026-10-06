"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRequest } from "@/lib/admin";

const KIND_LABELS: Record<AdminRequest["kind"], string> = {
  deletion: "Suppression de compte",
  contact: "Message",
};

export function AdminRequestRow({
  request,
  formattedCreatedAt,
}: {
  request: AdminRequest;
  formattedCreatedAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function post(body: Record<string, string>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => null);
        setError(responseBody?.error ?? "Une erreur est survenue.");
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Supprimer « ${request.email} » ? Tous ses lieux et appareils seront supprimés avec, définitivement.`)) {
      return;
    }
    post({ action: "delete", accountId: request.accountId });
  }

  return (
    <tr>
      <td className="px-4 py-2 text-ink-2">{formattedCreatedAt}</td>
      <td className="px-4 py-2 text-ink">{KIND_LABELS[request.kind]}</td>
      <td className="px-4 py-2 text-ink">{request.email}</td>
      <td className="px-4 py-2 text-ink-2">{request.message ?? "—"}</td>
      <td className="px-4 py-2">
        {request.handledAt ? (
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[13px] font-medium text-ok">
            Traité
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => post({ action: "mark-request-handled", requestId: request.id })}
              className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              Marquer traité
            </button>
            {request.kind === "deletion" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleDelete}
                className="inline-flex min-h-11 items-center rounded-xl bg-late-soft px-3 text-sm font-medium text-late transition-colors hover:bg-late-soft disabled:opacity-50"
              >
                Supprimer le compte
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-[13px] text-late">{error}</p>}
      </td>
    </tr>
  );
}
