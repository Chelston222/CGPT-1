# Retention School ICP Field Kit Workflow

Status: production workflow
Owner: 222Emails / Retention School
Companion skill: `docs/RETENTION_SCHOOL_ICP_FIELD_KIT_SKILL.md`

## Purpose

Create a growing owned library of Retention School resources for appointment-led ICPs, with each resource reusable across downloads, LinkedIn carousels, posts, email, resource pages and future sales enablement.

## Canonical flow

IDEA -> SOURCE KIT -> SOURCE LOCK -> RED TEAM -> CAROUSEL SCRIPT -> SCRIPT LOCK -> REAL IMAGE GENERATION -> SLIDE QA -> REPAIR LOOP -> PDF EXPORT -> STORAGE -> GOVERNED LINKEDIN INTAKE -> PUBLICATION VERIFY -> PERFORMANCE -> REUSE

## Required stage statuses

- SOURCE_DRAFT
- SOURCE_LOCKED
- SCRIPT_LOCKED
- VISUAL_GENERATING
- VISUAL_QA
- VISUAL_REPAIR
- VISUAL_READY
- PDF_READY
- STORED
- APPROVED_FOR_SOCIAL
- SCHEDULED
- POSTED
- LIVE_VERIFIED
- MEASURED
- REUSE_READY

A kit cannot skip directly from source draft to scheduled. Buffer acceptance is not publication proof.

## Wave 1 build order

1. 001 Chauffeurs - Open Quote Recovery System - reference / already posted
2. 002 Salons & Barbers - Rebooking & Quiet-Week Recovery Kit - next
3. 003 Aesthetics Clinics - Consultation-to-Treatment Recovery Kit
4. 004 Laser & Skin Clinics - Course Completion & Return Booking Kit
5. 005 Dental Practices - Unfinished Treatment Plan Follow-Up Kit
6. 006 Nail & Beauty Salons - Lapsed Client Return Kit
7. 010 Beauty Training Academies - Enquiry-to-Enrolment Follow-Up Kit
8. 008 Fitness Studios - Trial-to-Member & Lapsed Member Recovery Kit
9. 009 Massage & Wellness - Repeat Booking Rhythm Kit
10. 007 Physio & Recovery Clinics - Care-Continuity Admin Follow-Up Kit

## Ultra production prompt

Use this internally for every kit:

"Build this Retention School ICP Field Kit as a genuinely useful, commercially relevant resource for the named appointment-led ICP. Preserve the owned source separately from social assets. First attack the problem choice, usefulness, differentiation, evidence safety and connection to Client Return Systems. Fix material weaknesses before visual work. Then turn the source into a concise 10-slide LinkedIn carousel where every slide adds one new idea, decision or action. Use real image generation only. Generate exactly one complete standalone portrait slide per image. Never place two or more slides, panels that represent separate slides, miniature slide previews, a contact sheet, collage, grid, montage or merged board inside any generated image. Never substitute SVG, vector output, coded graphics, HTML screenshots, manually rendered PNGs or chat-created download graphics for actual image generation. Maximum 10 generated images in one image-generation call. Use the approved Retention School visual language: warm cream/bone, deep navy, restrained orange, premium editorial typography, strong hierarchy, generous whitespace, ICP-specific imagery and mobile legibility. Keep the family resemblance to the Chauffeur benchmark without cloning its layouts. Never fabricate testimonials, percentages, results, benchmarks, client proof or star ratings. Do not invent logo artwork. Avoid excessive orange underlines and decorative clutter. No em dashes. After generation, red-team the set slide by slide for truth safety, spelling, clipping, hierarchy, duplication, ICP specificity, narrative progression and the single-slide contract. If any image contains more than one conceptual slide, it fails automatically. Regenerate only failed slides and preserve all passed slides. Then independently double-verify the full set against the source kit and storage requirements. Do not mark VISUAL_READY until both verification passes succeed. Preserve individual slide assets, source kit, carousel copy, final PDF, caption, stable ID/revision and posting/performance metadata for future reuse."

## Sequential red-team gates

### Gate 1 - ICP problem

Pass only when:
- the problem is common enough to matter;
- the business can act on it without buying software first;
- the resource does not require unsupported performance claims;
- the resource is distinct from existing Field Kits;
- the resource clearly belongs to the named ICP rather than being generic retention advice.

### Gate 2 - resource value

Pass only when the kit contains at least:
- one tracker/board;
- one SOP or cadence;
- usable copy/templates or decision logic;
- exclusions/suppression rules;
- metrics;
- an obvious action the business can take immediately.

### Gate 3 - carousel quality

Pass only when:
- one idea per slide;
- hook clearly names or visually signals the ICP;
- copy is short enough for feed/mobile use;
- no filler slide exists;
- every slide advances the story;
- CTA names the actual kit;
- slide 9 is the resource CTA unless a stronger approved narrative requires otherwise;
- slide 10 closes with Retention School, not a hard sales pitch.

### Gate 4 - image-generation contract

Pass only when:
- each output is a single complete slide;
- exactly one conceptual slide exists in each image;
- no collage, grid, contact sheet, montage, merged board or embedded slide thumbnails appear;
- no vector/SVG/coded substitute is used;
- no fake proof appears;
- no fake logo is created;
- layouts feel part of one system without being repetitive;
- imagery is specific to the ICP;
- typography remains highly legible at mobile size;
- no text is clipped or materially altered.

Any image violating the single-slide contract is discarded and regenerated individually.

### Gate 5 - sequential double verification

Pass A: content and truth QA, slides 1 through 10 in order.

For each slide verify:
- correct ICP;
- correct intended idea;
- approved meaning preserved;
- spelling and UK English;
- no em dash;
- no fabricated evidence;
- no accidental currency error;
- no compliance or clinical overreach.

Pass B: visual and production QA, slides 1 through 10 in order.

For each slide verify:
- one standalone slide only;
- no collage or merge;
- correct sequence number;
- mobile-readable hierarchy;
- no clipping;
- no duplicated or missing content;
- restrained orange;
- consistent margins and visual family;
- category imagery is credible;
- no fake logo.

Only after all 20 checks pass can the kit become VISUAL_READY.

## Repair loop

If one or more slides fail:

1. Freeze every passing slide.
2. Record the exact failed slide number and failure reason.
3. Regenerate only the failed slide or failed subset.
4. Re-run Pass A and Pass B on the replacement.
5. Re-run a final 1-to-10 sequence check.

Do not restart a full 10-image batch unless the whole visual system is materially wrong.

## PDF and storage gate

Before PDF_READY:
- exactly 10 pages;
- page order matches approved slide order;
- no accidental compression or visual substitution that degrades quality;
- exact PDF byte count and SHA-256 captured;
- source kit remains separate from the PDF;
- individual generated slide assets remain retained.

For every kit retain:
- source resource;
- individual slide images;
- carousel script;
- caption;
- final PDF;
- stable kit ID/revision;
- status history;
- LinkedIn/Buffer identifiers after release;
- publication verification;
- later performance notes;
- future reuse date.

Do not delete individual slide assets after PDF creation or posting.

## Kit 002 locked story

ICP: Salons & Barbers
Resource: Rebooking & Quiet-Week Recovery Kit

Commercial problem: clients leave without a next appointment, irregular customers fade out, and quiet diary capacity is filled reactively.

Outcome: create a simple operating system for identifying rebooking leakage, finding genuinely overdue clients and turning return intent into booked appointments without generic mass chasing.

### Approved 10-slide sequence

1. The most expensive empty salon chair is often attached to a client who already knows you.
2. The leak starts when a client leaves without a clear next appointment or next action.
3. Memory-based follow-up fails because staff are busy and every client has a different return rhythm.
4. The Rebooking Gap Tracker: client, last service, last visit, expected return cycle, next booking, overdue status, last contact and next action.
5. Separate the lists: unbooked at checkout, overdue regulars, quiet-week opportunities and clients who should not be contacted.
6. Run a simple cadence: ask at checkout, remind around the expected return window, follow up once when appropriate, then close the loop.
7. The free Field Kit includes the tracker, Lapsed Client Return List, Quiet-Week Recovery SOP, message bank and weekly diary recovery checklist.
8. Measure bookings, not message volume: rebooking rate, overdue clients contacted, return bookings, recovered diary value and quiet-slot fill rate.
9. Download the free Salons & Barbers Rebooking & Quiet-Week Recovery Kit.
10. Retention School: practical client-return systems for appointment-led businesses.

## Kit 002 creative direction

- premium UK salon/barber environment, never generic beauty-stock styling;
- mix editorial type-led slides with realistic operating visuals;
- chairs, mirrors, booking diary, appointment cards, client-return tracker and calendar logic as visual metaphors;
- warm bone/cream background family, deep navy hierarchy and restrained orange emphasis;
- large typography and strong whitespace;
- no excessive orange underline treatment;
- sophisticated but practical, like a premium operator field guide;
- no fake performance statistics;
- no unrealistic promises;
- no collage;
- no multi-slide image;
- no fake logo recreation.

## Stop conditions

Stop and repair before export if any of the following occur:
- image generation returns fewer or more than the intended ten standalone slides;
- any output is a collage or contains multiple conceptual slides;
- slide copy is materially changed;
- text is clipped or illegible;
- visual system drifts materially between slides;
- a claim becomes stronger than the approved source;
- a fake logo appears;
- slide order becomes ambiguous;
- a healthcare-adjacent kit crosses into clinical advice.

A kit is complete only when both the finished social asset and the owned reusable resource remain preserved.
