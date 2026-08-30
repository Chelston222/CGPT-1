# Hook OS HEXP-001 - Appointment-Led Outbound

Status: READY FOR OWNER-APPROVED LIVE EXECUTION, NOT YET LIVE
Effective design date: 2026-08-30

## Objective
Identify which first-line hook family produces the strongest commercially relevant response from comparable UK appointment-led prospects without increasing approved outreach volume or weakening any existing prospect, sender, compliance, suppression, dedupe or human-authority gate.

## Cohort
Primary test cohort: UK salons and barbers that satisfy the current ICP and Lead Identification Gate.

Every eligible prospect must be GREEN before prospect-facing outreach. Existing pipeline is not grandfathered around the gate.

Do not mix materially different verticals into one comparison if avoidable.

## Channel
Use one approved outbound channel for a single experiment run. Do not combine email, LinkedIn DM and calls into one result set.

Recommended first channel: the highest-volume currently healthy direct-outbound lane at execution time, verified from live sender/channel state immediately before launch.

## Constants to hold reasonably stable
- same offer/next step: Free Revenue Recovery Check or the current approved direct next step for that sequence;
- same underlying body structure after the opening hook;
- same CTA;
- same touch number;
- comparable ICP/vertical and business size where practical;
- same sending window/cadence rules;
- same sender-health requirements;
- same Lead Identification Gate, suppression, dedupe and opt-out rules;
- no price, guarantee, scarcity or scope changes inside the experiment.

## Initial hook arms
Use four materially different families rather than cosmetic rewrites.

### Arm A - Diagnostic question
Parent concept H001
`What happens after a client leaves without rebooking?`

### Arm B - Contrarian / belief shift
Parent concept H005
`You may not need more leads. You may need more of your existing clients to return.`

### Arm C - Commercial question
Parent concept H006
`How many good clients left happy and never booked again?`

### Arm D - Condition / system diagnosis
Parent concept H004
`If your best clients have to remember to come back, you don't have a return system.`

Before live use, each exact variant must pass the current truth/proof and channel QA. If any line creates an unsupported implication for a specific prospect, rewrite or block it rather than forcing the arm.

## Allocation
Target a balanced directional test using existing approved capacity only.

Preferred first pass: 20 eligible exposures per arm, 80 total, provided the current live lane has capacity and all gating remains green.

If fewer than 20 eligible exposures per arm are available, record the result as INSUFFICIENT_DATA rather than padding the cohort or lowering lead quality.

No volume increase is authorised merely to complete the test.

## Pre-defined primary outcome
**Relevant Positive Response Rate** = relevant positive responses / eligible delivered exposures.

A relevant positive response shows genuine engagement with the commercial problem or a willingness to continue the conversation. Generic acknowledgements, opt-outs, bounces, automated replies and irrelevant responses do not count.

## Deeper commercial outcomes
Track separately and rank more heavily when they occur:
1. qualified commercial conversation;
2. qualified Free Revenue Recovery Check;
3. paid diagnostic or paid-offer progression;
4. buyer / attributable revenue.

A hook with lower raw response but deeper paid progression can outrank a higher-response hook.

## Ineligible exposure rules
Exclude from the denominator only when the message was not genuinely eligible for evaluation, for example:
- hard delivery failure before exposure;
- duplicate prevented from sending;
- prospect became suppressed/DNC before send;
- route/gate failure discovered before send;
- technical send failure with no delivery evidence.

Do not remove ordinary negative replies from the denominator.

## Contamination rules
Mark an arm or run contaminated when material differences exist in offer, CTA, touch number, vertical, sender reputation, timing, body copy, personalisation depth or prospect quality that make the comparison unreliable.

Contaminated runs are learning evidence, not winner-certifying evidence.

## Stop conditions
Stop or pause immediately when:
- Lead Identification Gate fails;
- sender/bounce/complaint risk rises materially;
- suppression/dedupe/reconciliation fails;
- the exact hook creates a truth/proof concern;
- reply quality indicates the hook is systematically misleading;
- owner pauses the test;
- a live platform/compliance requirement changes.

## Decision rule
After the first balanced pass:
- if data is tiny, imbalanced or contaminated -> INSUFFICIENT_DATA;
- if one arm leads on relevant response but has no deeper commercial evidence -> PROMOTE TO SECOND TEST, not CORE;
- if an arm shows directionally stronger relevant response plus deeper qualified progression -> PROMOTE;
- CORE requires repeated evidence across more than one clean cohort/run;
- RETIRE only after enough clean evidence or a hard truth/brand/channel reason.

Do not use conventional statistical-significance language unless the sample and analysis actually support it.

## Follow-up experiment
Once a family is PROMOTED, test 70/20/10-style allocation only after sufficient evidence exists:
- 70% proven/close variants;
- 20% permutations of the winner;
- 10% new challenger concepts.

## Logging
Every exposure should retain, where operationally safe:
- Hook ID;
- hook family;
- exact variant;
- experiment ID HEXP-001;
- cohort;
- channel;
- touch number;
- eligible/delivered state;
- relevant response state;
- qualified conversation/RRC/paid progression/buyer outcomes;
- uncertainty or contamination notes.

Hook Lab remains the experiment system of record. Do not alter the existing Message Ledger schema merely to make this experiment easier.
