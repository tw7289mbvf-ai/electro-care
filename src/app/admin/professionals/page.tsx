import { requireAdminPage } from "@/lib/admin";
import { getAdminProfessionals } from "@/lib/booking-admin";
import { AdminProfessionalsManager } from "@/components/AdminProfessionalsManager";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

// spec "Professionals directory, in the admin page": list, create, edit, switch on or
// off. Same rules as /admin — 404 for any other account or visitor (requireAdminPage),
// no link from the user interface. The Google rating and the notes live here only.
export default async function AdminProfessionalsPage() {
  await requireAdminPage();
  const professionals = await getAdminProfessionals();

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/admin">Administration</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Annuaire des professionnels
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Un professionnel en statut Refus ou inactif n&apos;est jamais proposé. Les utilisateurs ne voient que le
            nom, la ville et le prix.
          </p>
        </header>
        <AdminProfessionalsManager professionals={professionals} />
      </main>
    </div>
  );
}
