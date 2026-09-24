# Electro Care

Home appliance maintenance app for the French market. B2C MVP: responsive web app, French-only UI, email reminders.

## Langue

Tout texte visible par l'utilisateur dans l'application (libellés, placeholders, boutons, messages d'erreur, titres de page, contenu des écrans, etc.) doit être écrit en français. Cette règle s'applique à chaque nouvel écran ou composant ajouté au projet, sans qu'il soit nécessaire de le redemander.

Le code lui-même (noms de variables, fonctions, commentaires, commits) reste en anglais, comme le veut la convention du projet.

## Where things live

- Product decisions: the Claude Doc "Electro Care – One-Page Spec (B2C MVP)" (https://claude.ai/artifact/QVsDz6zhy97VVDTLB4Cj2v). It is the source of truth.
- `docs/spec.md`: snapshot of that doc. Read it before any product work. Do not edit it here; it is re-exported when the doc changes.
- `docs/referentiel_entretien_france.xlsx`: domain reference (equipment, maintenance tasks, legal obligations, nameplates), maintained by hand.
- `seed/`: JSON generated from the workbook by `scripts/build_seed.py`. Never edit by hand; see `seed/README.md`.

## Data model (decided)

- Navigation: Place → Category → Appliance.
- Place: name, commune and postcode, property type (`enums.property_type`). Legal reminders are computed per place, since local rules can differ from national ones.
- Appliance: `place_id` and `category` are required; everything else is optional (name, brand, model, serial number, purchase date, room, equipment type). Place + category is a valid record. When no name is given, the display falls back to the equipment type's label, then the category's, completed with brand and room when known.
- Each appliance field records its source (`enums.field_source`: invoice, nameplate, manual) in `field_sources` (JSONB, one entry per tracked field). The nameplate is authoritative for identity (model, serial, power, refrigerant); the invoice for purchase date and price. When a field is cleared, delete its `field_sources` key — never set it to `null`.
- A Document (`enums.document_type`) links to one or more appliances: one invoice can cover a whole kitchen.
- Maintenance tasks are instantiated per appliance from `seed/maintenance_tasks.json`, matched on `equipment_type_id`.

## Rules

- Complete, don't duplicate: a capture matching an incomplete appliance in the same place, category and brand is offered as a completion. Never merge silently.
- Brand identifier validation uses only `seed/brand_nameplates.json` entries with `status: "verified"`.
- From a nameplate photo, keep only the cropped plate, never the full image: it shows the inside of someone's home (GDPR).
- Seed texts from the workbook are unaccented ASCII. Proofread and accent them before they reach the UI.
- Plans follow the spec: `free` (unlimited appliances, reminders, guides) and `paid` (technician booking). Tasks with `performer: "pro"` are the candidates for booking.
- Aucune page affichant des données utilisateur n'est mise en cache statiquement.
- La catégorie est le niveau d'affichage, le type d'équipement porte tâches et obligations.

## Production database operations

- Two roles, two different jobs — never let them cross:
  - **`authenticated`** is what the running app connects as (`DATABASE_URL` /
    `DATABASE_URL_UNPOOLED`, in Vercel and in `.env.local`). It owns nothing, does not
    bypass row-level security, and every query attaches the caller's own session JWT
    (`src/lib/db.ts`) so RLS actually scopes the row set to their account.
  - **`neondb_owner`** owns every table and bypasses RLS entirely (`rolbypassrls =
    true`). It exists for schema migrations and one-off admin queries only — it must
    never be the app's `DATABASE_URL`, in any environment, ever. If a future cutover
    (e.g. the EU region move) ever repoints `DATABASE_URL` at a `neondb_owner`
    connection string, the app silently loses row-level isolation between accounts:
    every account would see every other account's data. Before flipping `DATABASE_URL`
    in Vercel, confirm the new value's role is `authenticated`, not `neondb_owner`.
- Both role passwords rotate outside of Vercel's env-var history. Vercel's
  `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are stored as **Secret** (not Config) on
  purpose — never downgrade them to Config, even to make `vercel env pull` work again.
- To run `scripts/migrate.mjs` (or any one-off admin script) against production, fetch
  the `neondb_owner` connection string at the moment you need it with
  `neonctl connection-string main --role-name neondb_owner` (pooled and unpooled),
  export it inline for that single command, and let the shell variable go out of scope.
  Never run `vercel env pull --environment=production`: it writes the production
  password to a file on disk (and can't pull `authenticated`'s Secret value anyway).
- Never display a database password (or any connection string containing one) in
  plaintext in any output — mask it (e.g. keep host/user, replace the password segment)
  before printing, or redirect straight to a scratch file the same way.
- Always test schema/data changes on a disposable Neon branch (or, for a structural
  change like adding RLS to a table, a disposable project) first — see the
  `schema_migrations` journal pattern and the RLS policies in `scripts/migrate.mjs` —
  and delete that branch/project once it's served its purpose: one created before a
  password rotation still answers to the old password after the rotation.
- `scripts/migrate.mjs` assumes the database it's pointed at either has none of these
  tables yet or already has `account_id` on every one of them: `CREATE TABLE IF NOT
  EXISTS places (...)` no-ops on a pre-existing table, so a legacy `places` without
  `account_id` makes the very next statement (`CREATE POLICY ... USING (account_id =
  auth.uid())`) fail — safely, inside the transaction, rolled back — but only once you
  are sure that's what you're pointed at. Never run this script against the old
  pre-auth production database (`neon-beige-feather` / `curly-base-57056864`,
  `us-east-1`) expecting it to add the account_id/RLS layer in place: that database's
  existing rows have no account to attach to, by design (see `docs/spec.md`, "Empty
  start") — it is being retired, not migrated in place.

## Commands

<!-- TODO: build, test and lint commands for this stack. Run /init: Claude Code proposes them and suggests improvements to this file. -->
