import Link from "next/link";

// Spec: links to the three legal pages, visible whether signed in or out.
export function Footer() {
  return (
    <footer className="mt-auto border-t border-line py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-x-4 px-5 text-sm text-ink-2">
        <Link href="/legal/mentions-legales" className="inline-flex min-h-11 items-center hover:underline">
          Mentions légales
        </Link>
        <Link href="/legal/confidentialite" className="inline-flex min-h-11 items-center hover:underline">
          Politique de confidentialité
        </Link>
        <Link href="/legal/conditions" className="inline-flex min-h-11 items-center hover:underline">
          Conditions d&apos;utilisation
        </Link>
      </div>
    </footer>
  );
}
