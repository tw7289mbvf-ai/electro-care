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
- `neonctl branches create` prints a `connection_uris` block with the new branch's
  `neondb_owner` password by default. Never rely on a text filter (`grep -v`, `sed`) to
  strip it before printing — a header's exact wording/casing can miss the filter and
  the password prints anyway (found 2026-09-29: `grep -v -i "connection_uri"` didn't
  match the actual "Connection Uri" header). Always pass `-o json` and pipe through
  `jq` keeping only the fields you need (e.g. `jq '{id: .branch.id, name:
  .branch.name}'`), never a field holding a connection string or password — this is a
  structural guarantee (the field is never selected) rather than a hope that a pattern
  matches. The same rule applies to any other command whose output can carry a secret,
  including a role's `reset_password` call below: prefer discarding the whole response
  (`> /dev/null`) over filtering it, since with only a status code to report there is
  nothing a filter needs to remove in the first place. A branch also inherits its
  parent's role passwords at creation time, so a leaked branch password is also the
  parent's password at that moment — rotating the parent afterward doesn't
  retroactively protect the branch, which still answers to the old password until its
  own is separately reset (`POST
  /projects/{project_id}/branches/{branch_id}/roles/{role_name}/reset_password` via
  `neonctl api`, output discarded the same way) or the branch is deleted (found
  2026-09-27, chantier 3; both passwords rotated 2026-09-29 after the filter miss
  above).
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
  are sure that's what you're pointed at. Never run it against a legacy pre-auth
  database expecting it to add the account_id/RLS layer in place: such rows have no
  account to attach to, by design (see `docs/spec.md`, "Empty start").
- Only one Neon project exists: `electro-care-eu` / `icy-union-72562625`
  (`eu-central-1`). The old pre-auth US project (`neon-beige-feather` /
  `curly-base-57056864`, `us-east-1`) and its Vercel integration store were deleted
  on 2026-10-05, without migration. The org is Vercel-managed: `neonctl projects
  delete` is refused ("organization is managed by Vercel"); a Neon project is deleted
  by deleting its Vercel storage store.
- `scripts/test-isolation.mjs` cannot run on a disposable branch of the EU project
  (`electro-care-eu` / `icy-union-72562625`): this project has a legacy web access
  role, so schema-only branches are refused outright, and a normal (data-copying)
  branch still comes up with `neon_auth.project_config.endpoint_id` pointing at the
  *parent's* endpoint, not its own — `/token` fails with `jwk not found` until that row
  is fixed, and fixing it by hand broke `/token` a different way (500). A disposable
  project isn't available either (the org is Vercel-managed). Found and given up on
  during the 2026-09-24 dashboard/management work — don't rediscover this each
  session. Until Neon fixes branch-created Auth wiring for this project: back up
  `main` first (`neonctl branches create --parent main --name main-backup-<date>`, kept,
  not expiring), run `scripts/migrate.mjs` (idempotent) to confirm schema is current,
  read the script's cleanup block out loud before running it — it must delete only the
  two account ids it just created, never by email pattern — then run
  `scripts/test-isolation.mjs` once against `main` itself. Afterwards, verify by id
  (`SELECT id FROM neon_auth.user WHERE id = ANY(...)`, expect zero rows) that both
  throwaway accounts are actually gone — the script's own cleanup calls are not
  silently trustworthy on their own.
- Self-service account deletion (`POST /delete-user`) does not work on this Neon Auth
  instance: it 401s with no session (route exists) but 404s with a valid one. Checked
  for a config toggle — `neonctl neon-auth plugins list`, `neon-auth config
  email-password get`, and the full `/auth/*` Management API surface (`neonctl api
  --list`) — none exposes one; the only account-deletion endpoint Neon exposes is the
  admin one (`DELETE .../auth/users/{id}`, already used for admin-delete). The
  self-service "Supprimer mon compte" button is hidden in `src/app/settings/page.tsx`
  until a fallback is chosen — see that file's comment. Found 2026-09-27, chantier 3;
  don't rediscover this each session.

## Git

- Le début de chaque chantier commence par `git fetch` puis une branche créée à partir
  d'un `main` local à jour (`git checkout main && git merge --ff-only origin/main`
  avant `git checkout -b ...`) : les PR sont fusionnées sur GitHub, jamais localement,
  donc le `main` local est systématiquement périmé sans ce fetch.
- Toute PR a `main` pour base, jamais une autre branche de fonctionnalité : une PR
  fusionnée dans une branche qui n'est pas `main` ne touche ni `main` ni la production,
  même si GitHub affiche la PR comme "Merged" (trouvé 2026-09-27 : la #12, base
  `maintenance-levels-account`, fusionnée sans jamais atteindre `main`).

## Économie

- Pas de sous-agents en parallèle, pas de `/code-review max`, pas d'ultrareview, sans mon accord explicite.
- Ne lire que les fichiers nécessaires à la tâche en cours ; pas d'exploration large.
- Réponses courtes ; pas de long récapitulatif si non demandé.

## Commands

<!-- TODO: build, test and lint commands for this stack. Run /init: Claude Code proposes them and suggests improvements to this file. -->
