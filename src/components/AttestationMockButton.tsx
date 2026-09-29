"use client";

import { useRef, useState } from "react";

// Mock: opens the file picker, but nothing is ever read from or sent with this input
// (no name attribute, value never inspected) — document storage doesn't exist yet
// (spec's "Managing Appliances").
export function AttestationMockButton() {
  const [showNotice, setShowNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <input ref={fileInputRef} type="file" className="hidden" tabIndex={-1} aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          fileInputRef.current?.click();
          setShowNotice(true);
        }}
        className="self-start text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        Ajouter l&apos;attestation
      </button>
      {showNotice && <p className="text-xs text-zinc-400 dark:text-zinc-500">Le dépôt des documents arrive bientôt.</p>}
    </div>
  );
}
