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

- The Neon `neondb_owner` password rotates outside of Vercel's env-var history. Vercel's
  `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are stored as **Secret** (not Config) on
  purpose — never downgrade them to Config, even to make `vercel env pull` work again.
- To run `scripts/migrate.mjs` (or any one-off script) against production, fetch the
  connection string at the moment you need it with `neonctl connection-string main`
  (pooled and unpooled), export it inline for that single command, and let the shell
  variable go out of scope. Never run `vercel env pull --environment=production`: it
  writes the production password to a file on disk.
- Never display a database password (or any connection string containing one) in
  plaintext in any output — mask it (e.g. keep host/user, replace the password segment)
  before printing, or redirect straight to a scratch file the same way.
- Always test schema/data changes on a disposable Neon branch first (see the
  `schema_migrations` journal pattern in `scripts/migrate.mjs`), and delete that branch
  once it's served its purpose — a branch created before a password rotation still
  answers to the old password after the rotation.

## Commands

<!-- TODO: build, test and lint commands for this stack. Run /init: Claude Code proposes them and suggests improvements to this file. -->
