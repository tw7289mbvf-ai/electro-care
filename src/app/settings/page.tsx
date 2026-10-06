import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/server";
import { hasPendingDeletionRequest } from "@/lib/account-requests";
import { getAccountPreferencesOrNull } from "@/lib/account-preferences";
import { hasLoggedEvent } from "@/lib/product-events";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { RequestAccountDeletionButton } from "@/components/RequestAccountDeletionButton";
import { ContactAdminForm } from "@/components/ContactAdminForm";
import { EmailRemindersToggle } from "@/components/EmailRemindersToggle";
import { MultiHomeInterestButton } from "@/components/MultiHomeInterestButton";
import { ThemePicker } from "@/components/ThemePicker";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { BackLink, LINK_ACTION } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  const alreadyRequestedDeletion = await hasPendingDeletionRequest();
  const preferences = await getAccountPreferencesOrNull();
  const alreadyClickedMultiHome = await hasLoggedEvent("multi_home_interest_clicked");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/">Tableau de bord</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Paramètres
          </h1>
          <p className="mt-1 text-sm text-ink-2">{session.user.email}</p>
        </header>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-[19px] font-semibold text-ink">Modifier mon compte</h2>
          <ChangePasswordForm />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-[19px] font-semibold text-ink">Affichage</h2>
          <ThemePicker initialTheme={theme} />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-[19px] font-semibold text-ink">Rappels</h2>
          <EmailRemindersToggle initialEnabled={preferences?.emailRemindersEnabled ?? true} />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-[19px] font-semibold text-ink">Offre multi-logements : bientôt disponible</h2>
          <p className="text-sm text-ink-2">
            Vous gérez plusieurs logements ? Dites-nous si cela vous intéresse.
          </p>
          <MultiHomeInterestButton alreadyClicked={alreadyClickedMultiHome} />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="font-display text-[19px] font-semibold text-ink">Vie privée</h2>
          <ul className="flex flex-col">
            <li>
              <Link href="/legal/mentions-legales" className={LINK_ACTION}>
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/legal/confidentialite" className={LINK_ACTION}>
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/legal/conditions" className={LINK_ACTION}>
                Conditions d&apos;utilisation
              </Link>
            </li>
          </ul>
          <RequestAccountDeletionButton alreadyRequested={alreadyRequestedDeletion} />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <ContactAdminForm />
        </section>
      </main>
    </div>
  );
}
