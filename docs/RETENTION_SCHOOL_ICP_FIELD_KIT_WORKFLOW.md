# Retention School ICP Field Kit Workflow

## Purpose

Create a growing owned library of Retention School resources for appointment-led ICPs, with each resource reusable across downloads, LinkedIn carousels, posts, email and future sales enablement.

## Canonical flow

IDEA -> SOURCE KIT -> RED TEAM -> CAROUSEL SCRIPT -> VISUAL GENERATION -> QA -> PDF EXPORT -> STORAGE -> GOVERNED LINKEDIN INTAKE -> PERFORMANCE -> REUSE

## Required stage statuses

- SOURCE_DRAFT
- SOURCE_LOCKED
- SCRIPT_LOCKED
- VISUAL_GENERATING
- VISUAL_QA
- VISUAL_READY
- PDF_READY
- STORED
- APPROVED_FOR_SOCIAL
- SCHEDULED
- POSTED
- MEASURED
- REUSE_READY

A kit cannot skip directly from source draft to scheduled.

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

"Build this Retention School ICP Field Kit as a genuinely useful, commercially relevant resource for the named appointment-led ICP. Preserve the owned source separately from social assets. First attack the problem choice, usefulness, differentiation, evidence safety and connection to Client Return Systems. Fix material weaknesses before visual work. Then turn the source into a concise 10-slide LinkedIn carousel where each slide adds one new idea, decision or action. Generate real images only, one independent portrait slide per image. Never generate a collage, grid, contact sheet, merged panel, vector substitute or coded visual. Maximum 10 generated images in one image-generation call. Use the approved Retention School visual language: warm cream/bone, deep navy, restrained orange, premium editorial typography, strong hierarchy, generous whitespace, ICP-specific imagery and mobile legibility. Never fabricate testimonials, percentages, results, benchmarks, client proof or star ratings. Do not invent logo artwork. Avoid excessive orange underlines and decorative clutter. No em dashes. After generation, red-team the set slide by slide for truth safety, spelling, clipping, hierarchy, duplication, ICP specificity and narrative progression. Regenerate only failed slides. Then independently double-verify the full set against the source kit and storage requirements. Do not mark VISUAL_READY until both verification passes succeed. Preserve individual slide assets, source kit, carousel copy, final PDF, caption, stable ID/revision and posting/performance metadata for future reuse."

## Sequential red-team gates

### Gate 1 - ICP problem

Pass only when:
- the problem is common enough to matter;
- the business can act on it without buying software first;
- the resource does not require unsupported performance claims;
- the resource is distinct from existing Field Kits.

### Gate 2 - resource value

Pass only when the kit contains at least:
- one tracker/board;
- one SOP or cadence;
- usable copy/templates or decision logic;
- exclusions/suppression rules;
- metrics.

### Gate 3 - carousel quality

Pass only when:
- one idea per slide;
- hook clearly names or visually signals the ICP;
- copy is short enough for feed/mobile use;
- no filler slide exists;
- CTA names the actual kit.

### Gate 4 - visual production

Pass only when:
- each generated image is one slide only;
- no collage/merge exists;
- no fake proof exists;
- layouts feel part of one system without being repetitive;
- imagery is specific to the ICP;
- text remains legible.

### Gate 5 - double verification

Pass A: exact slide QA.
Pass B: full narrative/source/storage QA.

Only then mark VISUAL_READY.

## Storage contract

For every kit retain:
- source resource;
- individual slide images;
- carousel script;
- caption;
- final PDF when assembled;
- stable kit ID/revision;
- status history;
- LinkedIn/Buffer identifiers after release;
- later performance notes;
- future reuse date.

Do not delete individual slide assets after PDF creation or posting.
