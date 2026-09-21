# Electro Care – One-Page Spec (B2C MVP)

> Snapshot of the Claude Doc [Electro Care – One-Page Spec (B2C MVP)](https://claude.ai/artifact/QVsDz6zhy97VVDTLB4Cj2v), exported 2026-09-21 (doc rev 13). The doc is the source of truth: edit it there, then re-export this file.

## Problem & Vision

Home appliances and equipment (boiler, washing machine, pool pump, HVAC, etc.) lose years of useful life because owners don't know when maintenance is due or how to perform it. Electro Care centralizes every appliance a household owns, sends timely reminders for periodic upkeep, and gives clear step-by-step instructions for each task — extending equipment lifespan and preventing costly failures.

## Target User & Market

Homeowners in France (v1 market: France only) who want to extend the life of their appliances and equipment, stay compliant with mandatory maintenance obligations (e.g. annual boiler servicing), and manage it all from a single place. The interface itself is in French, matching the target market — no multi-language support needed for v1.

## MVP Feature Set (v1)

- Organize everything by place, then by category ([Places and Categories](#places-and-categories))
- Add one or several appliances from an invoice (document), a nameplate photo or manual entry (photo and/or text) ([Adding Appliances](#adding-appliances))
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

## Adding Appliances

Three entry points feed one appliance record. None fills it alone, so each is designed to complete the others.

| Source | Provides | Unlocks |
| --- | --- | --- |
| Invoice (document) | Purchase date, price, retailer, item names | Warranty tracking, proof of purchase |
| Nameplate (photo) | Exact model, serial number, power, refrigerant | Legal status, spare parts, real age |
| Manual (photo and/or text) | Category, brand, room | Maintenance plan right away |

- **Minimum record**: place + category. Nothing else blocks creation.
- **Complete, don't duplicate**: a new capture matching an incomplete record in the same place, category and brand is offered as a completion, not a second record.
- **One invoice, several appliances**: the app lists the detected lines and the user ticks the appliances. Lines carrying a WEEE eco-fee (éco-participation DEEE) are a strong hint. Invoices received by email arrive through a dedicated forwarding address, with no mailbox access.
- **Nameplate locator**: shows where the plate usually sits for the category, adapted to the brand once known (typed or detected from the logo). The brand's identifier format validates what the photo read.
- **Benefit-led prompts**: each missing field is requested through what it unlocks ("Add the invoice to track the warranty"), not a completeness score.
- **Capture in a web app**: v1 is a responsive web app, so capture uses the phone browser's camera, one shot at a time with framing guidance. No live scanner.

## Business Model

Freemium, with a monthly subscription for the paid tier.

- Free: unlimited appliances, reminders, and self-service maintenance guides
- Paid (subscription): everything in Free, plus booking a technician for complex interventions (e.g. boiler descaling, HVAC servicing) directly through the app

## Out of Scope for v1

- B2B version for company equipment/machinery — a strong future opportunity (different buyer, multi-site/multi-user needs, likely per-machine pricing), deliberately excluded from v1 to keep the first build focused on B2C
- Native iOS/Android apps — v1 ships as a responsive web app
- Markets outside France
