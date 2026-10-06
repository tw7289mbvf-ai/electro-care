import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { FeedbackLink } from "@/components/FeedbackLink";

// The footer renders inside the root layout, where getSession() throws when it tries
// to refresh or clear a stale cookie (only allowed in actions/route handlers): treat
// that as signed out rather than failing the whole page.
async function hasSession(): Promise<boolean> {
  try {
    return Boolean((await auth.getSession()).data?.user);
  } catch {
    return false;
  }
}

// Spec: links to the three legal pages, visible whether signed in or out.
// "Donner mon avis" only for signed-in accounts, behind FEEDBACK_ENABLED.
export async function Footer() {
  const feedbackEnabled = process.env.FEEDBACK_ENABLED === "true";
  const signedIn = feedbackEnabled && (await hasSession());
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
        {signedIn && <FeedbackLink />}
      </div>
    </footer>
  );
}
