"use client";

import { useState } from "react";
import { submitSatisfactionSurveyAction } from "@/app/actions";
import type { SatisfactionResponse } from "@/lib/account-preferences";

const OPTIONS: { value: SatisfactionResponse; label: string }[] = [
  { value: "very_disappointed", label: "Très déçu" },
  { value: "somewhat_disappointed", label: "Un peu déçu" },
  { value: "not_disappointed", label: "Pas déçu" },
];

// Shown exactly once (marked server-side at render time, see src/app/page.tsx) — closing
// without answering is a valid outcome, it never reappears.
export function SatisfactionSurveyModal() {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, setIsPending] = useState(false);

  if (dismissed) return null;

  async function handleAnswer(response: SatisfactionResponse) {
    setIsPending(true);
    await submitSatisfactionSurveyAction(response, comment);
    setIsPending(false);
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        {submitted ? (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Merci pour votre avis.</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Comment vous sentiriez-vous si vous ne pouviez plus utiliser Electro Care ?
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAnswer(option.value)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire ? (facultatif)"
              className="mt-3 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              rows={2}
            />
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-3 text-xs text-zinc-400 underline-offset-2 hover:underline"
            >
              Fermer sans répondre
            </button>
          </>
        )}
      </div>
    </div>
  );
}
