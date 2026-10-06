# Electro Care – One-Page Spec (B2C MVP)

> Snapshot of the Claude Doc [Electro Care – One-Page Spec (B2C MVP)](https://claude.ai/artifact/QVsDz6zhy97VVDTLB4Cj2v), exported 2026-09-22 (doc rev 60). The doc is the source of truth: edit it there, then re-export this file.

## Problem & Vision

Home appliances and equipment (boiler, washing machine, pool pump, HVAC, etc.) lose years of useful life because owners don't know when maintenance is due or how to perform it. Electro Care centralizes every appliance a household owns, sends timely reminders for periodic upkeep, and gives clear step-by-step instructions for each task — extending equipment lifespan and preventing costly failures.

The ambition is a "Doctolib of the home": the home's health record (legal obligations, maintenance, documents), files ready to send to an insurer or for a sale, and later the booking of the professionals who keep it compliant. Unlike the French home logbook apps (CLÉA, Mon Suivi Logement, Homekonect), which send generic reminders, Electro Care tracks each legal obligation with a status, its risks and a ready-to-send request.

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
- Free for individuals: every feature, with no paid tier for them
- Revenue from professionals and product links, as described in Business Model

## Places and Categories

The app is organized by place first, then by category, then by appliance. A place is more than a folder:

- **Commune**: legal reminders are computed per place, because local rules vary. Example: the SPANC inspection is due at least every 10 years, but a commune can set a shorter interval ([source](https://www.ethnasystem.eu/2026/04/12/controle-spanc-est-il-obligatoire-pour-lassainissement-non-collectif/)).
- **Postal address, optional**: street and number, with an optional second line, entered once on the place so that intervention requests carry it without retyping. Like the rest of the place, never visible to the admin.
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

- **Where obligations show**: the dashboard gives the global status and the overdue ones, place by place. Each place's page lists the obligations to act on first, red then orange, then an "À jour" group, collapsed, with the number of up-to-date obligations and the next action date. Tapping it lists each of them with its last completion date and next due date.
- **Risks on every obligation**: fine, insurance consequences, liability and physical danger, taken from the reference data.
- **Three colour-coded statuses**, like a vehicle inspection: green (up to date, recent valid proof), orange (to confirm, the app needs an input from the user), red (overdue, no valid proof, action needed). Only green counts as compliant: orange is never "in order", since an insurer won't accept "it was recent".
- **Orange covers two cases**: a threshold to settle (is the air conditioner 4 kW or more?), or a date to pin down (recent, but which month?).
- **One date question per obligation**: each names the appliance and the intervention ("When was the boiler last serviced?"), with answers graded on the real legal interval: month and year; "less than a year ago" without a precise date (orange); "more than a year ago" (red); and last, a single "never or I don't know" button (red, shown as a priority). The interval follows the obligation: one year for a boiler, two for a heat pump, ten for the SPANC inspection.
- **Dates in French**: picked from two lists (month in words, year) and shown as "septembre 2026", never with a day.
- **Actions and colours**: green shows no button; red shows "C'est fait"; orange shows "Mettre à jour", which opens a window aimed at what is missing, never the generic appliance form. For a power threshold, it asks "Quelle est la puissance du groupe extérieur ?" (read on its nameplate; for a multisplit, the outdoor unit's power is what counts), with "Moins de 4 kW", "4 kW ou plus", a figure, or "Je ne sais pas". For a date, it asks the obligation's own date question. Below the threshold, the obligation becomes "Non concerné", shown in grey and left out of the compliance count; entering the power in the appliance card has the same effect. Status badges use the three status colours, "À confirmer" in orange like its status. Buttons keep one colour everywhere: "C'est fait" in green, "Mettre à jour" in orange like the status it resolves, and "Reporter" in orange; the two orange buttons never appear side by side, one in obligations, the other in the monthly maintenance.
- **Bridge to professionals**: most obligations need a professional, so an obligation coming due offers the ready-to-send request today, and booking a listed professional once the professional side exists.

## Onboarding Questionnaire

Asked at first use and for each new place. Afterwards, appliances are added one by one, as described in Adding Appliances.

- **Plain-language questions**: property type first, skipped when it was set at place creation, then about ten questions: main heating, fireplace or stove, hot water, air conditioning, gas cooking, sewer or septic tank, pool, well, vehicles for a main or second home, and the smoke detector.
- **Back button and recap**: a "Précédent" button lets the user go back and change any answer. Nothing is created during the questionnaire: at the end, a recap lists what will be created, each line editable, and a single confirmation creates it all. Going back never leaves a stray appliance behind.
- **Adaptive**: nothing is asked twice. No fireplace question when a stove is the main heating, no air conditioning question when a reversible heat pump already covers it, no vehicle question for a rental.
- **Vehicles phrased per home**: "Un véhicule est-il rattaché à votre résidence principale ?" Each vehicle belongs to one home only, where it is mainly parked, so it is never counted twice.
- **Questions name the appliance**: every question and every date request states which appliance and which intervention it is about.
- **Never blocking**: every obligation question offers "Je ne sais pas", as a regular button in last position. It adds a "to check" item on the home screen, with a tip to find the answer, such as the water bill for the sewer connection.
- **Smoke detector**: always created, since it is mandatory in every home. Four answers: "Oui, un détecteur autonome", "Oui, relié à mon alarme", "Non" (overdue) and "Je ne sais pas". A standalone detector: the date printed on its back and what it means, a manufacturing date, replaced 10 years later, or a replacement deadline ("à remplacer avant 2034"), used as is; future years are offered for the deadline; recent models have a sealed 10-year battery, so no yearly battery reminder. A detector linked to an alarm: the app asks whether the alarm is monitored by a provider. Monitored: the obligation shows "Suivi par votre télésurveillance" in green, a one-time check asks whether the detector bears the CE EN 14604 marking ("Je ne sais pas" keeps it to confirm, with a tip to check its label or the provider's contract), and the provider's visits are recorded like any intervention. Not monitored: a monthly reminder to test it from the alarm's app, and the replacement date asked as for a standalone detector. Existing detectors stay standalone; a user changes the type from the detector's card ("Type": "Détecteur autonome" or "Relié à mon alarme", followed by the same two questions), or from the "Mettre à jour" window when the detector is to confirm, which offers "Il est relié à mon alarme" next to the date.
- **Printed dates can be in the future**: the expiry date of a gas hose and a detector's replacement deadline are future dates, so their year lists extend ahead; intervention dates never do.
- **Pool**: the answer names the safety device (barrier, alarm, cover or shelter); "no device" shows as overdue.
- **Dates**: asked through each obligation's own question, described in Obligations and Maintenance.
- **One date for an appliance and its flue**: a stove, insert or boiler and its flue get a single date question, since servicing and sweeping are done in the same visit. A "done separately?" link allows two dates, or marking only one of the two as done.
- **Appliance upkeep, optional**: a gate question separates it from the legal part; if the user opts in, the appliance checklist and the maintenance level follow, as described in Maintenance Levels.
- **Then improve**: brand, model and purchase date are added later from the appliance card.

## Accounts and Privacy

Each person has an account, and sees only their own places and appliances. This is the foundation everything else depends on.

- **First screen for a signed-out visitor**: log in or create an account at the top; then a short text explaining the app; below it, a demonstration dashboard. The demo shows fixed, fictional data only, never anyone's real data, and is read-only. A sample home with a few appliances and two overdue obligations in red lets the visitor grasp in one glance that the app tracks legal obligations and flags what is late.
- **Sign-in for the MVP**: email and password. Google and Apple sign-in can come later.
- **Per-account isolation**: places, appliances, documents and their obligations belong to an account and are visible only after signing in.
- **EU region**: the database is hosted in the European Union, since the app stores personal data (invoices carry names and addresses). This keeps GDPR compliance simple.
- **Empty start**: accounts begin with no data; the earlier test records are not carried over.
- **Account settings**: the existing Paramètres menu gathers editing the account (what Neon Auth allows, such as the password), requesting the deletion of the account, and contacting the admin. No new icon.
- **Delete my account**: Neon Auth offers no self-service deletion, so the user sends a request from Paramètres, with a clear message ("your account will be deleted within 7 days"). The admin handles it from the admin page, reusing the tested deletion action. GDPR allows up to one month to act on an erasure request; the privacy policy states the 7-day delay.
- **Contact the admin**: a short form in Paramètres. Messages land in the admin page with the sender's email, and the admin replies from their own mailbox: no email service is needed for this.
- **Legal pages**: legal notice, privacy policy and simple terms of use, required before opening the app to other testers.

## Administration

An admin page, reserved to the owner's account, gives a global view without access to users' content.

- **Figures without personal data**: accounts (total, new in the last 7 days, active in the last 30), places, appliances, completed questionnaires, obligations by status.
- **Account list**: email, creation date, last sign-in, number of places and appliances. Not their content, no addresses and no appliances, following the GDPR need-to-know principle.
- **Three actions**: suspend or reactivate, delete (with a confirmation, in cascade), and send a password reset link. Passwords are never visible: only a hash is stored, so the admin can neither read nor set one.
- **Requests**: deletion requests and contact messages, each with its date and a "handled" mark. A deletion request is processed with the existing delete action.
- **No impersonation** ("sign in as") in the MVP: too sensitive.
- **Audit log**: every admin action, with who, what and when.
- **Hidden from clients**: no link to the admin page anywhere in the interface, not even for the owner, who reaches it by its direct address. For any other account or a signed-out visitor, the admin page and its actions answer "not found" (404), without revealing they exist.
- **Access and isolation**: reserved to the owner's account and checked server-side; hiding the link is discretion, the server check is the protection. Seeing all accounts must never bring the owner database connection back into the app: accounts go through the Neon Auth administration API, figures through aggregate views. The isolation test proves that a regular account gets a 404 on the admin page and on each admin action.

## Dashboard

What a signed-in user sees first.

- **Global status first**: across all places, "2 overdue · 1 to confirm · 12 up to date", and "3 maintenance tasks this month".
- **"À faire maintenant"**: only overdue (red) obligations, grouped under each place's name so it stays readable, each with its "C'est fait" button. The urgent stays actionable from the home screen.
- **One card per place**: name, property type and status dots, ordered by property type (main home, second home, long-term rental, short-term rental). Letting the user reorder places is noted for later, outside the MVP.
- **Place page**: tapping a card opens all the place's obligations with their actions, the month's maintenance, its appliances by category, and "Ajouter un appareil".
- **Same layout with one place**: consistent, and the urgent stays at the top.
- **Empty**: a single button, "Ajouter votre premier lieu", which leads straight into the questionnaire. Otherwise "Ajouter un lieu" sits below the place cards.

## Managing Appliances

Tapping an appliance opens its card.

- **Every line opens a card**: tapping any obligation or maintenance task, whatever its status, up to date included, opens its card.
- **Top of the appliance card, everything about its upkeep**: first its legal obligations, each with its status, next due date and last intervention (month, provider, contact, attestation). Then every maintenance task of the place's level, each shown once: under "À faire" when due this month or overdue, with "C'est fait" and "Reporter"; under "À venir" otherwise, with its next month ("Prévu en octobre 2026"), including a task never done yet whose season has not come. The card and the place's monthly list therefore never disagree. Each line shows its last completion when there is one. Then its routines, more frequent than monthly. An appliance without legal obligations, such as a washing machine, shows its maintenance directly. An appliance with no task at the place's level shows "Aucun geste indispensable pour cet appareil. Passez au niveau Recommandé pour voir ses 2 gestes d'entretien.", with the actual count, rather than an empty block.
- **History, never overwritten**: each "C'est fait" adds an entry (month, provider, contact, attestation); it never replaces the previous one. The most recent entry sets the status and the next due date. The card lists the history, most recent first, older entries collapsed. This history is what the insurer file and the sale file will show: regular sweeping year after year weighs more than a single certificate. Same principle for maintenance tasks.
- **Correcting an entry**: "Modifier" appears only on the appliance card, never in the dashboard or place page lists, and only on an entry already recorded. It makes the entry editable behind a warning, "Attention : vous modifiez une intervention déjà enregistrée. Le statut et la prochaine échéance seront recalculés.", then a confirmation. A modified entry shows "modifiée le …", so the record stays credible as proof.
- **Bottom of the appliance card, the product**: brand, model, power, purchase date, warranty end and room, editable.
- **Mark a legal obligation as done**: "C'est fait" opens a window with the month and year of the intervention, the current month or a past one, never a future one: a done intervention is a proof. It also asks the provider's name and, optionally, their email or phone, and offers "Ajouter l'attestation". Until document storage exists, the attestation button is a mock: it opens the file picker but sends and stores nothing, and says document upload is coming soon. The obligation then shows "Fait en octobre 2026 par Chauffage Dupont", also in the expanded "À jour" group. Each provider entered is a tradesperson the platform can later invite.
- **Appointment booked**: on a red or orange obligation, "Rendez-vous pris" records a future date, to the day, and the provider. The obligation shows "Rendez-vous le 15 novembre 2026 avec Chauffage Dupont" with a blue badge and leaves "À faire maintenant", but does not count as up to date. Once the date has passed, the app asks "Le rendez-vous du 15 novembre a-t-il eu lieu ?": yes opens "C'est fait" prefilled with the month and provider; no offers to reschedule or cancel, and the obligation returns to its status. A first step towards booking inside the app.
- **Mark a maintenance task as done**: one tap, no window. The task card shows the last completion and its history at the top, and the procedure below.
- **Delete an appliance**: with a confirmation; its obligations and reminders are removed with it.
- **Delete a place**: with a warning that names what goes with it ("also deletes 4 appliances and their reminders"), then a cascade delete.

## Import from Invoices (planned)

An invoice or a photo of it fills in appliances automatically, instead of entering them one by one.

- **What it reads**: each appliance on the document, matched to an equipment type of the reference data, with brand, exact model, purchase date and warranty end.
- **The user confirms**: "Nous avons trouvé 6 appareils", each line ticked or not before being added; existing appliances of the same type are completed rather than duplicated.
- **Where it is offered**: in the questionnaire, just before the appliance checklist, and from the dashboard or a place page to complete or add appliances.
- **Nothing is stored**: the file is read, then deleted; only the confirmed appliance data is kept.
- **Reading is done by an AI service** (Anthropic API), paid per use with a spending cap set by the owner. It must be listed in the privacy policy, since invoices carry names and addresses.
- **Test case**: a Boulanger invoice listing six appliances (oven, fridge-freezer, washing machine, dishwasher, dryer, microwave) with their exact references.

## Reminders

- **Legal obligations, by email**: a first email three months before the deadline, leaving time to find a professional; a reminder one month before if not done; another at the deadline. Sent from the app's own domain through a European email service.
- **A ready-to-send request in the email**: a quote request (new provider) or an intervention request (usual provider), naming the appliance, its brand and model when known, the intervention and its legal basis ("Annual gas boiler service, Saunier Duval Thema C, required by decree 2009-649"), and the place's postal address when entered. When the provider's email is known from a previous "C'est fait", it is filled in as the recipient. One button opens it in the user's mail app; details in Reminder Emails.
- **Brand and model, optional**: asked in the appliance card and at reminder time ("add the model, it will appear in your request"), only for appliances that have a nameplate.
- **Lifespan maintenance, in the app only**: no email. The count of tasks due this month shows in the global status; the tasks themselves are listed on each place's page, timed by each task's frequency and the months it applies to. Legal obligations never appear in it, even when an appliance carries both.
- **Times in the monthly list**: "Entretien du mois" shows its total hands-on time in its header, and each task its own time, or "Professionnel" when a professional does it.
- **Two actions on every task**: a green "C'est fait", which sets the next date, and an orange "Reporter", which moves the task to next month. For a monthly task, postponing simply skips this month; for a less frequent one, it never skips a whole interval, so a task due every two years cannot vanish for two years.
- **Routines stay in the appliance card**: tasks more frequent than monthly (weekly, after each use) never reach the dashboard or the place page, so both stay readable.
- **Calendar**: a subscription link for the user's calendar comes later, as a small addition.

## Maintenance Guidance

- **General procedure**: every maintenance task shows the general recommended steps from the reference data, with tools and what goes wrong if skipped.
- **Model-specific step-by-step**: when brand and model are known, a precise procedure is generated on demand from the manufacturer's manual, stored and reused for everyone with the same model. It complements the general procedure, labelled "from the manufacturer's manual" with a link and a "report an error" button. The manual is summarised, never copied. Free, like everything for individuals.
- **Product links**: each task that lists consumables (filters, descaler, batteries) offers a link to buy them, with the exact reference once the model is known. Links are marked as affiliate links and never presented as neutral advice.
- **Never for risky interventions**: model-specific steps only cover tasks users do themselves (filters, descaling); gas and combustion work stays with a professional.
- **In the MVP**: a single demonstration on one precise product, written once, with no generation.

## Maintenance Levels

Lifespan maintenance comes in levels, so users are not overwhelmed by every recommendation.

- **Three settings, labelled by their meaning**: Aucun (legal obligations only), Essentiel (avoid breakdowns and damage), Recommandé (also make appliances and the house last). Recommandé includes Essentiel, and legal obligations are always tracked, whatever the setting. A fourth level, Complet, was dropped: it added a handful of unrelated tasks that no single label could describe, and they now sit in Recommandé.
- **A gate question first**: after the legal questions, "Vos obligations légales sont prêtes. Voulez-vous aussi suivre l'entretien de vos autres appareils ?" "Non, plus tard" sets the place to Aucun and ends the questionnaire, with upkeep available later from the place page.
- **Then the level, once the appliances are known**: if yes, the appliance checklist, then "Quel suivi voulez-vous pour l'entretien de vos appareils ?" with two choices, Essentiel "Éviter les pannes et les dégâts" (by default) and Recommandé "Faire aussi durer vos appareils et votre maison", each with its time estimate, and the line "Vos obligations légales restent suivies dans tous les cas." Then the recap. The place page offers all three settings, Aucun included.
- **Estimated time per month**: each level shows the hands-on time it asks for, computed from all the place's appliances: for a typical house, about an hour a month on Essentiel and two on Recommandé. It includes the everyday upkeep of the appliances created by the legal questions, such as the boiler pressure check, but not the legal obligations themselves, tracked separately and mostly done by a professional. Only the time the user actually acts counts, not the time an appliance runs: a two-hour descaling cycle asks for five minutes.
- **Example, the kitchen**: Essentiel cleans the cooker hood's grease filter every month, since grease buildup is a common cause of kitchen fires. Recommandé adds the oven door seal check, a pyrolysis cycle every three months and the hood's charcoal filter.

## Reminder Emails

The first step of the MVP's validation: the reminders are the core promise and the reason users come back.

- **Schedule**: for each legal obligation, three months before the due date, one month before if neither done nor booked, and at the due date. Reminders stop as soon as "C'est fait" or "Rendez-vous pris" is recorded. One email per user per day at most, grouping obligations due around the same date.
- **The request inside**: the two ready-to-send versions, quote and intervention, addressed to the provider when their email is known.
- **Brand and model missing**: the email says why to add them, with a link to the appliance card: "Ajoutez la marque et le modèle : votre demande sera plus précise, et le professionnel pourra prévoir les bonnes pièces."
- **Sending**: through Brevo, a French email service, from the app's own domain, with SPF, DKIM and DMARC set up. Sign-up and password emails move to the same service. Until the domain and the account exist, everything is built but sending stays switched off.
- **Opt-out**: a "Rappels par e-mail" switch in Paramètres, on by default, and a link at the bottom of each email.
- **Measurement**: a click on a link in the email is counted through a first-party redirect; no open-tracking pixel.

## Measuring the MVP

- **When**: around mid-December 2026, after eight to ten weeks of real use by 50 to 100 accounts.
- **Seven indicators**, thresholds to treat as hypotheses: activation, at least 60 % of accounts finish the questionnaire; engagement, at least 40 % of them record a "C'est fait" or an appointment within 30 days; retention, at least 30 % come back in the second month; reminder effect, at least 20 % of reminder emails followed by an action within 30 days; promise kept, at least 30 % of red obligations turn green within 60 days; attachment, at least 40 % "très déçu" in the Sean Ellis survey; business model, at least three property professionals ready to pay 5 € per home per month, tracked by hand.
- **Reading rule**: indicators 1 to 3 met but not 7, the product works and monetization needs rework; indicators 1 to 3 missed, fix the product before anything else.
- **Instrumentation**: product events recorded in the app's own database, with no cookie and no third-party tool: account created, questionnaire completed, "C'est fait", appointment booked, reminder sent, reminder link clicked, obligation status change. A KPI panel in the admin page computes the indicators, aggregated, without personal data.
- **Monthly activity, aggregated**: a 12-month bar chart with three series: legal interventions recorded, maintenance tasks done, and overdue obligations brought up to date. Counted on the date the user records it in the app, not the intervention month they declare; entries from the questionnaire and from the history migration are left out. Status changes are recorded since 5 October 2026, so the third series starts then.
- **Compliance and activity per account, for support**: in the admin page, one line per account with its email, sign-up date, number of places, its counts of overdue, to-confirm and up-to-date obligations with a mini gauge, and this month's three activity counts; a line expands to its last twelve months. Sorted by overdue count. Never the appliances, places or addresses behind the counts. The privacy policy states it, and each viewing is written to the admin log.
- **Sean Ellis survey**: shown once in the app after 30 days of use: "Comment vous sentiriez-vous si vous ne pouviez plus utiliser Electro Care ?" with "Très déçu", "Un peu déçu", "Pas déçu", and an optional comment.

## Visual Design

Validated on 6 October 2026, on the design canvas ([Electro Care, nouveau design](https://claude.ai/artifact/UwRPCMp8kxwNMyEqaqLsAt)). The full charter, tokens, components and icons, is in docs/design.md in the repository.

- **Fresh and modern**: a light blue-grey ground, slate ink instead of black, and an electric blue for the brand, distinct from the green of "À jour".
- **Light by default, dark on request**: Paramètres offers "Affichage" with three choices, "Clair" (default), "Sombre" and "Selon le téléphone". The choice is kept in a first-party cookie on the device and applied when the page is built, so the page never flashes the wrong theme; signed-out pages follow the same cookie, light when there is none. One set of tokens per theme.
- **Compliance gauge on every level**: on the home screen for all places together, and at the top of each place page for that place alone, with the same card: "13 sur 28 obligations à jour", the segmented bar, its legend, and the month's maintenance with its duration.
- **Durations readable**: under an hour in minutes ("environ 45 min"), from an hour in hours and minutes rounded to five minutes ("environ 4 h 45").
- **Softer statuses**: red, orange and green appear as pale pills with dark text; only the compliance bar uses full colours.
- **Typography**: Bricolage Grotesque for titles and figures, Figtree for text, both self-hosted by the app so no visitor's IP address is sent to Google.
- **Airier**: one idea per line, no all-caps labels, no "A — B" or "A · B" strings; up-to-date obligations collapse into one line.
- **Icons**: one line icon per appliance type, in a rounded square tinted by status.
- **Accessibility**: touch targets of at least 44 px, text contrast of at least 4.5:1, statuses readable by text and lightness, not colour alone.

## Delivery Plan

Short, separate work sessions, each with the isolation test and the production procedure described in CLAUDE.md:

1. Date questions and actions by status. Done.
2. Focused dashboard and lifespan maintenance. Done.
3. Administration and GDPR basics. Done, except the text of the legal pages.
4. Maintenance levels and account settings. Done.
5. Place page (times, "C'est fait" and "Reporter") and accented reference texts. In progress.
6. Legal pages completed, then the app opens to a first circle of testers.
7. Obligation reminders by email, with the ready-to-send request. Requires the app's own domain and an email service account.
8. Product links on maintenance tasks, and the step-by-step demo on one product. Requires affiliate program accounts.
9. Documents: uploading proofs and invoices.
10. Insurer file and sale file, built on documents.
11. Tenants.
12. Professional side: the tradespeople's agenda, once usage is validated, starting with one city.

The calendar subscription link follows step 7.

## Tenants (planned)

In a long-term rental, several obligations fall on the tenant (boiler service, chimney sweeping, smoke detector upkeep, gas hose), while the owner bears the consequences with the insurer. Landlords chase these certificates by hand today. The feature is free for individual landlords; property managers handling many homes are part of the professional offer.

- **Tenant contacts**: the owner enters one or more tenant emails on the place.
- **Notice and proof**: before each tenant-liable deadline, the app emails the tenant a link to upload the proof, with no account needed. The link is single-use, time-limited and opens nothing else.
- **Routine maintenance**: the law already puts routine upkeep of the home and of the equipment listed in the lease on the tenant. The app sends the matching tasks in a seasonal email, twice a year, as a reminder only: no proof is asked for small tasks, and the natural checkpoint is the exit inspection. Only equipment provided by the owner and listed in the lease is covered, and replacing worn-out equipment stays with the owner.
- **Owner's view**: "tenant's responsibility: proof received" or "pending", with automatic reminders.
- **Short-term rentals unchanged**: the owner remains responsible for everything.
- **Privacy**: tenant emails are a third party's personal data. Only what is needed is kept, and they are deleted at the end of the lease.

## Business Model

Decided on 28 September 2026: individuals never pay. Revenue comes from professionals, as with Doctolib, where practitioners pay and patients don't.

- **Individuals, free**: every feature, from obligations and reminders to documents, guides and tenant follow-up for an individual landlord.
- **Tradespeople, paying**: later, heating engineers, chimney sweeps and other trades get an agenda and appointments from the app's users. Launched city by city, starting with one, since a professional only pays where the demand is.
- **Property professionals, paying**: property managers, short-term rental concierges and agencies managing many homes, for multi-place management and tenant follow-up at scale.
- **Product links**: affiliate commissions on the consumables of each maintenance task. A complement, not a business model on its own: Centriq, which also sold replacement parts through its app, closed its consumer product.
- **Later, partnerships**: insurers, for prevention and the insurer file, and home builders, for the logbook of new homes.

## Out of Scope for v1

- B2B version for company equipment/machinery — a strong future opportunity (different buyer, multi-site/multi-user needs, likely per-machine pricing), deliberately excluded from v1 to keep the first build focused on B2C
- Native iOS/Android apps — v1 ships as a responsive web app
- Markets outside France
