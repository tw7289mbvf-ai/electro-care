import Link from "next/link";

// Spec: links to the three legal pages, visible whether signed in or out.
export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 py-6 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-x-4 gap-y-1 px-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
        <Link href="/legal/mentions-legales" className="hover:underline">
          Mentions légales
        </Link>
        <Link href="/legal/confidentialite" className="hover:underline">
          Politique de confidentialité
        </Link>
        <Link href="/legal/conditions" className="hover:underline">
          Conditions d&apos;utilisation
        </Link>
      </div>
    </footer>
  );
}
