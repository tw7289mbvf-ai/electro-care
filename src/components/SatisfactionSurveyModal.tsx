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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6">
        {submitted ? (
          <>
            <p className="text-sm text-ink">Merci pour votre avis.</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-85"
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-[19px] font-semibold text-ink">
              Comment vous sentiriez-vous si vous ne pouviez plus utiliser Electro Care ?
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAnswer(option.value)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-line-strong px-4 py-2 text-left text-sm text-ink hover:bg-surface-2 disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire ? (facultatif)"
              className="mt-3 w-full rounded-lg border border-line-strong p-2 text-sm"
              rows={2}
            />
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-3 inline-flex min-h-11 items-center text-sm text-ink-2 underline-offset-2 hover:underline"
            >
              Fermer sans répondre
            </button>
          </>
        )}
      </div>
    </div>
  );
}
