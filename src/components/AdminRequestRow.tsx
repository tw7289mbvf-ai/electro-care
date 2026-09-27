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
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formattedCreatedAt}</td>
      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{KIND_LABELS[request.kind]}</td>
      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{request.email}</td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{request.message ?? "—"}</td>
      <td className="px-4 py-2">
        {request.handledAt ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            Traité
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => post({ action: "mark-request-handled", requestId: request.id })}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Marquer traité
            </button>
            {request.kind === "deletion" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleDelete}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Supprimer le compte
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
    </tr>
  );
}
