# Electro Care – One-Page Spec (B2C MVP)

> Snapshot of the Claude Doc [Electro Care – One-Page Spec (B2C MVP)](https://claude.ai/artifact/QVsDz6zhy97VVDTLB4Cj2v), exported 2026-09-22 (doc rev 28). The doc is the source of truth: edit it there, then re-export this file.

## Problem & Vision

Home appliances and equipment (boiler, washing machine, pool pump, HVAC, etc.) lose years of useful life because owners don't know when maintenance is due or how to perform it. Electro Care centralizes every appliance a household owns, sends timely reminders for periodic upkeep, and gives clear step-by-step instructions for each task — extending equipment lifespan and preventing costly failures.

## Target User & Market

Homeowners in France (v1 market: France only) who want to extend the life of their appliances and equipment, stay compliant with mandatory maintenance obligations (e.g. annual boiler servicing), and manage it all from a single place. The interface itself is in French, matching the target market — no multi-language support needed for v1.

## MVP Feature Set (v1)

- Personal account: sign in to see your own places and appliances; a signed-out visitor sees a demo dashboard ([Accounts and Privacy](#accounts-and-privacy))
- Organize everything by place, then by category ([Places and Categories](#places-and-categories))
- Onboarding questionnaire at first use and for each new place: plain-language questions create the equipment and its legal obligations ([Onboarding Questionnaire](#onboarding-questionnaire))
- Add one or several appliances from an invoice (document), a nameplate photo or manual entry (photo and/or text) ([Adding Appliances](#adding-appliances))
- Tap an appliance to edit or delete it; delete a place with a cascade warning ([Managing Appliances](#managing-appliances))
- Legal obligations and lifespan maintenance shown as two separate tracks, with the risks of non-compliance ([Obligations and Maintenance](#obligations-and-maintenance))
- Warranty and documents: one space per appliance for manuals, invoices and warranty forms of new products
- Automatic maintenance calendar: email reminders based on manufacturer or best-practice intervals
- Step-by-step maintenance guide per appliance and task
- Free tier: unlimited appliances, reminders, and guides
- Paid tier: adds on-demand booking of a technician for complex interventions

## Places and Categories

The app is organized by place first, then by category, then by appliance. A place is more than a folder:

- **Commune**: legal reminders are computed per place, because local rules vary. Example: the SPANC inspection is due at least every 10 years, but a commune can set a shorter interval ([source](https://www.ethnasystem.eu/2026/04/12/controle-spanc-est-il-obligatoire-pour-lassainissement-non-collectif/)).
- **Property type**: main home, second home or rental. It sets who is liable for upkeep and which seasonal tasks apply, such as winterizing a second home.
- **Sharing scope**: a place is the natural unit for inviting a tenant or a technician later, without exposing the other places.
- **Room**: optional tag, not a navigation level. Mainly used to tell two identical units apart, such as two splits in two bedrooms.

Categories are the level users see. There are ten, labeled in French in the interface: Cuisine, Buanderie, Chauffage & climatisation, Petit électroménager, Électronique, Jardin & piscine, Maison & sécurité, Énergie, Véhicules, Autre.

- **Equipment types drive the plan**: each equipment type in the reference data belongs to one category, and the type, not the category, carries maintenance tasks and legal obligations. Users rarely pick a category by hand: the photo, the invoice or a search by name finds the type.
- **No maintenance plan**: Électronique and Autre have none, but warranty tracking and documents work there.
- **Vehicles in v1**: warranty, documents and the mandatory technical inspection (contrôle technique). Mileage-based servicing comes later.

## Adding Appliances

Three entry points feed one appliance record. None fills it alone, so each is designed to complete the others.

| Source | Provides | Unlocks |
| --- | --- | --- |
| Invoice (document) | Purchase date, price, retailer, item names | Warranty tracking, proof of purchase |
| Nameplate (photo) | Exact model, serial number, power, refrigerant | Legal status, spare parts, real age |
| Manual (photo and/or text) | Category, brand, room | Maintenance plan right away |

- **Minimum record**: place + category. Nothing else blocks creation.
- **Complete, don't duplicate**: a new capture matching an incomplete record in the same place and category is offered as a completion, not a second record. The match uses the brand when both records have one, otherwise the equipment type: records created by the questionnaire have no brand.
- **One invoice, several appliances**: the app lists the detected lines and the user ticks the appliances. Lines carrying a WEEE eco-fee (éco-participation DEEE) are a strong hint. Invoices received by email arrive through a dedicated forwarding address, with no mailbox access.
- **Nameplate locator**: shows where the plate usually sits for the category, adapted to the brand once known (typed or detected from the logo). The brand's identifier format validates what the photo read.
- **Benefit-led prompts**: each missing field is requested through what it unlocks ("Add the invoice to track the warranty"), not a completeness score.
- **Capture in a web app**: v1 is a responsive web app, so capture uses the phone browser's camera, one shot at a time with framing guidance. No live scanner.

## Obligations and Maintenance

Legal obligations and lifespan maintenance are shown as two separate tracks, built on the same data. One appliance can carry both: a boiler's mandatory annual service and its monthly pressure check. In the reference data, 31 of 154 tasks are legal obligations, and 24 of them need a professional.

|  | Legal obligations | Maintenance (lifespan) |
| --- | --- | --- |
| Stake | Fine, insurance, liability | Savings, longevity |
| Who | Mostly a professional | Mostly the user |
| Rhythm | Yearly or less often | Monthly to seasonal |
| To close | Proof attached | One tap |
| Postponing | Always visible | Free |
| Reminders | One by one, a month before the deadline | Grouped by season |

- **Home screen**: obligations first, sorted by urgency, then the season's maintenance checklist. A compliance banner sums it up: "2 overdue, 1 to confirm, 4 up to date".
- **Risks on every obligation**: fine, insurance consequences, liability and physical danger, taken from the reference data.
- **Three colour-coded statuses**, like a vehicle inspection: green (up to date, recent valid proof), orange (to confirm, the app needs an input from the user), red (overdue, no valid proof, action needed). Only green counts as compliant: orange is never "in order", since an insurer won't accept "it was recent".
- **Orange covers two cases**: a threshold to settle (is the air conditioner 4 kW or more?), or a date to pin down (recent, but which month?).
- **One date question per obligation**: each names the appliance and the intervention ("When was the boiler last serviced?"), with answers graded on the real legal interval: month and year; "less than a year ago" without a precise date (orange); "more than a year ago" (red); never, or I don't know (red, shown as a priority). The interval follows the obligation: one year for a boiler, two for a heat pump, ten for the SPANC inspection.
- **Dates in French**: picked from two lists (month in words, year) and shown as "septembre 2026", never with a day.
- **Actions by status**: green shows no button; red shows "C'est fait"; orange shows "Mettre à jour", whether a date or the power is missing.
- **Bridge to the paid tier**: most obligations need a professional, so an obligation coming due offers to book a technician.

## Onboarding Questionnaire

Asked at first use and for each new place. Afterwards, appliances are added one by one, as described in Adding Appliances.

- **Plain-language questions**: property type first, skipped when it was set at place creation, then about ten questions: main heating, fireplace or stove, hot water, air conditioning, gas cooking, sewer or septic tank, pool, well, vehicles for a main or second home, and the smoke detector.
- **Back button and recap**: a "Précédent" button lets the user go back and change any answer. Nothing is created during the questionnaire: at the end, a recap lists what will be created, each line editable, and a single confirmation creates it all. Going back never leaves a stray appliance behind.
- **Adaptive**: nothing is asked twice. No fireplace question when a stove is the main heating, no air conditioning question when a reversible heat pump already covers it, no vehicle question for a rental.
- **Vehicles phrased per home**: "Un véhicule est-il rattaché à votre résidence principale ?" Each vehicle belongs to one home only, where it is mainly parked, so it is never counted twice.
- **Questions name the appliance**: every question and every date request states which appliance and which intervention it is about.
- **Never blocking**: every obligation question offers "Je ne sais pas", shown as a discreet choice. It adds a "to check" item on the home screen, with a tip to find the answer, such as the water bill for the sewer connection.
- **Smoke detector**: always created, since it is mandatory in every home. The questionnaire asks whether one is installed ("no" shows as overdue), then the date printed on its back, which sets its replacement 10 years later. Recent models have a sealed 10-year battery, so there is no yearly battery reminder.
- **Pool**: the answer names the safety device (barrier, alarm, cover or shelter); "no device" shows as overdue.
- **Dates**: asked through each obligation's own question, described in Obligations and Maintenance.
- **One date for an appliance and its flue**: a stove, insert or boiler and its flue get a single date question, since servicing and sweeping are done in the same visit. A "done separately?" link allows two dates, or marking only one of the two as done.
- **Optional appliance checklist**: common appliances (fridge, washing machine, dishwasher…) seed the maintenance track the same way.
- **Then improve**: brand, model and purchase date are added later from the appliance card.

## Accounts and Privacy

Each person has an account, and sees only their own places and appliances. This is the foundation everything else depends on.

- **First screen for a signed-out visitor**: log in or create an account at the top; below it, a demonstration dashboard. The demo shows fixed, fictional data only, never anyone's real data, and is read-only. A sample home with a few appliances and two overdue obligations in red lets the visitor grasp in one glance that the app tracks legal obligations and flags what is late.
- **Sign-in for the MVP**: email and password. Google and Apple sign-in can come later.
- **Per-account isolation**: places, appliances, documents and their obligations belong to an account and are visible only after signing in.
- **EU region**: the database is hosted in the European Union, since the app stores personal data (invoices carry names and addresses). This keeps GDPR compliance simple.
- **Empty start**: accounts begin with no data; the earlier test records are not carried over.

## Dashboard

What a signed-in user sees first.

- **Empty**: a single button, "Ajouter votre premier lieu", which leads straight into the questionnaire.
- **Places stacked**: one below the other, ordered by property type: main home, second home, long-term rental, short-term rental. Letting the user reorder places is noted for later, outside the MVP.
- **Two add buttons at two levels**: "Ajouter un lieu" on the dashboard, and "Ajouter un appareil" inside each place, so an appliance is always created in its place. The add form no longer sits on the dashboard.
- **An action next to each obligation**: "C'est fait" on red, "Mettre à jour" on orange, nothing on green. The most frequent actions are one tap away from the status.

## Managing Appliances

Tapping an appliance opens its card.

- **Edit**: brand, model, power, purchase date, room, and the fields that resolve an orange status, without going back through the questionnaire.
- **Mark as done**: from the appliance card, or straight from an obligation on the dashboard ("C'est fait"). The user gives the month of the intervention, defaulting to the current month; the status turns green and the next due date is recalculated. Proof can be attached once documents exist.
- **Delete an appliance**: with a confirmation; its obligations and reminders are removed with it.
- **Delete a place**: with a warning that names what goes with it ("also deletes 4 appliances and their reminders"), then a cascade delete.

## Reminders

- **Legal obligations, by email**: a first email three months before the deadline, leaving time to find a professional; a reminder one month before if not done; another at the deadline. Sent from the app's own domain through a European email service.
- **A ready-to-send request in the email**: a quote request (new provider) or an intervention request (usual provider), naming the appliance, its brand and model when known, the intervention and its legal basis ("Annual gas boiler service, Saunier Duval Thema C, required by decree 2009-649"). One button opens it in the user's mail app.
- **Brand and model, optional**: asked in the appliance card and at reminder time ("add the model, it will appear in your request"), only for appliances that have a nameplate.
- **Lifespan maintenance, in the app only**: no email; the season's tasks show on the dashboard with a notification count.
- **Calendar**: a subscription link for the user's calendar comes later, as a small addition.

## Maintenance Guidance

- **General procedure, free**: every maintenance task shows the general recommended steps from the reference data, with tools and what goes wrong if skipped.
- **Model-specific step-by-step, paid tier**: when brand and model are known, a precise procedure is generated on demand from the manufacturer's manual, stored and reused for everyone with the same model. It complements the general procedure, labelled "from the manufacturer's manual" with a link and a "report an error" button. The manual is summarised, never copied.
- **Never for risky interventions**: model-specific steps only cover tasks users do themselves (filters, descaling); gas and combustion work stays with a professional.
- **In the MVP**: a single demonstration on one precise product, written once, with no generation.

## Delivery Plan

Short, separate work sessions, each with the isolation test and the production procedure described in CLAUDE.md:

1. Date questions and actions by status.
2. Lifespan maintenance in the app.
3. Obligation reminders by email. Requires the app's own domain and an email service account.
4. Model-specific step-by-step demo on one product.
5. Documents: uploading proofs, the basis for tenants.
6. Tenants.

The calendar subscription link follows step 3.

## Tenants (planned)

In a long-term rental, several obligations fall on the tenant (boiler service, chimney sweeping, smoke detector upkeep, gas hose), while the owner bears the consequences with the insurer. Landlords chase these certificates by hand today: automating it is a strong candidate for the paid tier.

- **Tenant contacts**: the owner enters one or more tenant emails on the place.
- **Notice and proof**: before each tenant-liable deadline, the app emails the tenant a link to upload the proof, with no account needed. The link is single-use, time-limited and opens nothing else.
- **Routine maintenance**: the law already puts routine upkeep of the home and of the equipment listed in the lease on the tenant. The app sends the matching tasks in a seasonal email, twice a year, as a reminder only: no proof is asked for small tasks, and the natural checkpoint is the exit inspection. Only equipment provided by the owner and listed in the lease is covered, and replacing worn-out equipment stays with the owner.
- **Owner's view**: "tenant's responsibility: proof received" or "pending", with automatic reminders.
- **Short-term rentals unchanged**: the owner remains responsible for everything.
- **Privacy**: tenant emails are a third party's personal data. Only what is needed is kept, and they are deleted at the end of the lease.

## Business Model

Freemium, with a monthly subscription for the paid tier.

- Free: unlimited appliances, reminders, and self-service maintenance guides
- Paid (subscription): everything in Free, plus booking a technician for complex interventions (e.g. boiler descaling, HVAC servicing) directly through the app

## Out of Scope for v1

- B2B version for company equipment/machinery — a strong future opportunity (different buyer, multi-site/multi-user needs, likely per-machine pricing), deliberately excluded from v1 to keep the first build focused on B2C
- Native iOS/Android apps — v1 ships as a responsive web app
- Markets outside France
