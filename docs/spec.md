# Electro Care – One-Page Spec (B2C MVP)

> Snapshot of the Claude Doc [Electro Care – One-Page Spec (B2C MVP)](https://claude.ai/artifact/QVsDz6zhy97VVDTLB4Cj2v), exported 2026-09-22 (doc rev 19). The doc is the source of truth: edit it there, then re-export this file.

## Problem & Vision

Home appliances and equipment (boiler, washing machine, pool pump, HVAC, etc.) lose years of useful life because owners don't know when maintenance is due or how to perform it. Electro Care centralizes every appliance a household owns, sends timely reminders for periodic upkeep, and gives clear step-by-step instructions for each task — extending equipment lifespan and preventing costly failures.

## Target User & Market

Homeowners in France (v1 market: France only) who want to extend the life of their appliances and equipment, stay compliant with mandatory maintenance obligations (e.g. annual boiler servicing), and manage it all from a single place. The interface itself is in French, matching the target market — no multi-language support needed for v1.

## MVP Feature Set (v1)

- Organize everything by place, then by category ([Places and Categories](#places-and-categories))
- Onboarding questionnaire at first use and for each new place: plain-language questions create the equipment and its legal obligations ([Onboarding Questionnaire](#onboarding-questionnaire))
- Add one or several appliances from an invoice (document), a nameplate photo or manual entry (photo and/or text) ([Adding Appliances](#adding-appliances))
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

| | Legal obligations | Maintenance (lifespan) |
| --- | --- | --- |
| Stake | Fine, insurance, liability | Savings, longevity |
| Who | Mostly a professional | Mostly the user |
| Rhythm | Yearly or less often | Monthly to seasonal |
| To close | Proof attached | One tap |
| Postponing | Always visible | Free |
| Reminders | One by one, a month before the deadline | Grouped by season |

- **Home screen**: obligations first, with a status per place (up to date, to schedule, overdue), then the season's maintenance checklist.
- **Risks on every obligation**: fine, insurance consequences, liability and physical danger, taken from the reference data.
- **To confirm**: an obligation that depends on a threshold, such as air conditioning from 4 kW, stays "to confirm" until the nameplate or a single question settles it.
- **Bridge to the paid tier**: most obligations need a professional, so an obligation coming due offers to book a technician.

## Onboarding Questionnaire

Asked at first use and for each new place. Afterwards, appliances are added one by one, as described in Adding Appliances.

- **Plain-language questions**: property type first, which decides who is liable, then about ten questions: main heating, fireplace or stove, hot water, air conditioning, gas cooking, sewer or septic tank, pool, well, vehicles. Answers create the matching records and their obligations directly.
- **Adaptive**: nothing is asked twice. No fireplace question when a stove is the main heating, no air conditioning question when a reversible heat pump already covers it.
- **Never blocking**: every obligation question offers "Je ne sais pas", shown as a discreet choice. It adds a "to check" item on the home screen, with a tip to find the answer, such as the water bill for the sewer connection.
- **Smoke detector added automatically**: it is mandatory in every home, so the app only asks whether it is installed.
- **Last service date**: asked for every obligation created, as month and year. "I don't know" means "to schedule".
- **Optional appliance checklist**: common appliances (fridge, washing machine, dishwasher…) seed the maintenance track the same way.
- **Then improve**: brand, model and purchase date are added later through a photo or an invoice.

## Business Model

Freemium, with a monthly subscription for the paid tier.

- Free: unlimited appliances, reminders, and self-service maintenance guides
- Paid (subscription): everything in Free, plus booking a technician for complex interventions (e.g. boiler descaling, HVAC servicing) directly through the app

## Out of Scope for v1

- B2B version for company equipment/machinery — a strong future opportunity (different buyer, multi-site/multi-user needs, likely per-machine pricing), deliberately excluded from v1 to keep the first build focused on B2C
- Native iOS/Android apps — v1 ships as a responsive web app
- Markets outside France
