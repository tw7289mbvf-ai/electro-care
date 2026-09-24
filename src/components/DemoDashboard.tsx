// Fixed, fictional data only — never a database read. This is what a signed-out
// visitor sees, so it must be structurally impossible for it to expose anyone's
// real place, appliance or obligation.
const DEMO_APPLIANCES = [
  { name: "Chaudière au gaz", room: "Cellier", brand: "Chaffoteaux" },
  { name: "Détecteur de fumée", room: "Couloir", brand: "Kidde" },
  { name: "Chauffe-eau", room: "Salle de bain", brand: "Atlantic" },
];

const DEMO_OBLIGATIONS = [
  {
    status: "En retard" as const,
    title: "Entretien annuel de la chaudière",
    detail: "depuis le 3 mars 2026",
    risk: "Résiliation possible de l'assurance en cas de sinistre",
  },
  {
    status: "En retard" as const,
    title: "Remplacement de la pile du détecteur de fumée",
    detail: "depuis le 12 janvier 2026",
    risk: "Incendie non détecté",
  },
  {
    status: "À jour" as const,
    title: "Détartrage du chauffe-eau",
    detail: "prochaine échéance : 8 nov. 2026",
    risk: null,
  },
];

const STATUS_STYLES: Record<string, string> = {
  "En retard": "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  "À jour": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export function DemoDashboard() {
  return (
    <section className="flex flex-col gap-4 opacity-90">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Exemple de tableau de bord
        </h2>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          Données fictives, lecture seule
        </span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Appartement (exemple)</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Lyon · 69003 · Résidence principale</p>

        <div className="mt-4 flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Obligations
          </h4>
          <ul className="flex flex-col gap-3">
            {DEMO_OBLIGATIONS.map((o) => (
              <li key={o.title} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status]}`}>
                    {o.status}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{o.title}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">({o.detail})</span>
                </div>
                {o.risk && <p className="pl-1 text-xs text-zinc-500 dark:text-zinc-400">{o.risk}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DEMO_APPLIANCES.map((a) => (
            <div
              key={a.name}
              className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{a.name}</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {a.brand} · {a.room}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
