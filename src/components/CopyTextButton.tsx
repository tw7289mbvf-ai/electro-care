"use client";

import { useState } from "react";

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, permissions) — the text is
      // already shown on the page for a manual copy, so there is nothing else to do.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-fit items-center inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
    >
      {copied ? "Texte copié" : "Copier le texte"}
    </button>
  );
}
