import { requireAdminPage } from "@/lib/admin";
import { getAdminBookingRequests, getAdminProfessionals } from "@/lib/booking-admin";
import { AdminBookingQueue } from "@/components/AdminBookingQueue";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

// spec "Request queue, in the admin page". The one place where the admin sees an
// address, a phone number and an appliance, because the user sent them:
// admin_list_booking_requests() writes the journal entry for each viewing itself.
// Same rules as /admin — 404 for any other account or visitor.
export default async function AdminBookingsPage() {
  await requireAdminPage();
  const [requests, professionals] = await Promise.all([getAdminBookingRequests(), getAdminProfessionals()]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/admin">Administration</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            File des demandes de rendez-vous
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Chaque consultation de cette page est inscrite au journal d&apos;administration. Aucun e-mail n&apos;est
            envoyé : copiez le lien personnel de chaque professionnel et transmettez-le vous-même.
          </p>
        </header>
        <AdminBookingQueue requests={requests} professionals={professionals} />
      </main>
    </div>
  );
}
