# Agentic OS — Autonomous Executive Orchestration

Agentic OS is the outcome-first control plane for Chelston's work and time.

It exists to prevent backlog accumulation, stale recurring work, duplicate effort and calendar drift.

## Core contract

The system does **not** ask "what is unfinished?" and blindly carry it forward.

It asks:

1. What outcome is still required?
2. What has changed since this action was created?
3. Has another action, decision or artefact superseded it?
4. Is the action duplicated or already satisfied?
5. Is it executable now?
6. Is it still the highest-value use of scarce time?

Every candidate resolves to one of:

`EXECUTE | SCHEDULE | MERGE | SUPERSEDED | OBSOLETE | BLOCKED | DELEGATE | DEFER | KILL`

## Files

- `config.json` — operating policy, scoring weights and decay windows.
- `engine.mjs` — deterministic relevance, supersession, recurrence and priority engine.
- `calendar.mjs` — collision-safe, Europe/London-aware capacity planner and RFC5545 ICS renderer.
- `reconcile.mjs` — ownership-safe live calendar diff: create, update, delete, no-op, retain or fail closed.
- `run.mjs` — CLI orchestration entrypoint that emits task state, plan and reconciliation evidence.
- `fixtures/simulation.json` — changing multi-day workload acceptance fixture.
- `tests.mjs` — regression/acceptance suite.
- `public/agentic-os.ics` — public read-only Apple Calendar fallback feed.

## Input contract

`run.mjs` accepts a JSON state file containing:

```json
{
  "now": "2026-08-30T08:00:00+01:00",
  "tasks": [],
  "hardCommitments": [],
  "outcomes": [],
  "existingCalendarEvents": [],
  "freezeWindowMinutes": 120
}
```

`existingCalendarEvents` is optional. When supplied, the run emits an ownership-safe reconciliation diff against the desired AOS execution blocks. When omitted, the reconciliation layer correctly reports the desired owned blocks as creates without touching anything externally.

Task fields are intentionally explicit. Important fields include:

- `id`
- `actionId`
- `title`
- `desiredOutcome`
- `desiredOutcomeId`
- `createdAt`
- `lastValidatedAt`
- `deadline`
- `notBefore`
- `durationMinutes`
- `hard`
- `strategicPriority`
- `expectedValue`
- `impactProbability`
- `urgency`
- `dependencyIds`
- `supersedesIds`
- `supersededBy`
- `familyId`
- `assumptionsValid`
- `outcomeSatisfied`
- `status`
- `recurrence`
- `recurrenceReviewAt`

## Output contract

The engine emits:

- canonical task states
- audit reasons for every non-active decision
- supersession lineage
- ranked executable work
- capacity-safe execution blocks
- protected slack
- health metrics
- deterministic calendar reconciliation diff
- a generated ICS feed

Files written under `apps/agentic-os/state/` are:

- `latest.json`
- `reconciliation.json`
- `execution.ics`

The Green Gate fails if either task-state health or calendar-reconciliation health is red.

## Calendar ownership contract

Calendar blocks carry stable ownership metadata. A block keeps its Agentic OS identity when its time moves, so a live writer updates the existing Google event rather than creating a duplicate.

Required live event markers are:

- title begins `AOS |`
- `AOS_OWNER=agentic-os`
- `AOS_ACTION_ID=<stable action id>`
- `AOS_BLOCK_ID=<stable block id>` where available

Manual/personal events are inputs to capacity planning and are never rewritten.

`reconcile.mjs` enforces these rules:

- one desired action + one owned live event -> UPDATE or NOOP
- one desired action + no owned event -> CREATE
- multiple owned events for one action -> BLOCK / fail closed
- future owned event no longer desired and outside freeze window -> DELETE candidate
- owned event inside the freeze window -> RETAIN
- past owned event -> RETAIN for history
- manual event -> IGNORE
- `AOS |` event without unambiguous ownership markers -> BLOCK / fail closed

For multi-segment actions, unique `AOS_BLOCK_ID` markers are required before any mutation is allowed.

## Current live calendar architecture

The currently connected Google account exposes one primary calendar, `TRIPLE TWO EMAILS 🚀`. No dedicated secondary `AOS • EXECUTION` calendar is currently available through the connector.

Therefore the live ownership-safe path is:

`Agentic OS -> AOS-owned events on the Google primary calendar -> Google sync -> native Apple Calendar`

Only events carrying the explicit AOS ownership markers may be created, moved or removed by the system. Existing manual events and recurrences remain protected.

A dedicated secondary calendar remains a future isolation improvement if connector/account capability exposes one. The system must not pretend that calendar exists before it does.

## Runtime bridge

The deterministic repo engine does not contain Google OAuth credentials and does not independently call Google Calendar. Live source ingestion and live calendar reconciliation are performed by the existing **Agentic OS Omega Supervisor**, which uses the connected Calendar, GitHub and other authorised sources.

That supervisor must:

1. read current hard/manual calendar commitments
2. reconcile current task/outcome evidence
3. evaluate relevance, duplicates and supersession
4. rank only current executable work
5. apply the `reconcile.mjs` ownership contract to existing AOS-owned events
6. fail closed on duplicate or ambiguous ownership
7. preserve the two-hour freeze window under normal conditions
8. preserve audit lineage for retired work
9. regenerate the public fallback ICS from current/future AOS-owned events only after a successful live reconciliation
10. never manufacture completion when a connector or write is unavailable

The repo engine remains the deterministic policy/test layer. The supervisor is the live integration bridge. These roles are deliberately separate but governed by the same ownership and reconciliation contract.

## Apple Calendar and ICS

Primary editable path:

`Google Calendar account sync -> Apple Calendar`

Portable fallback:

`public/agentic-os.ics -> Apple Calendar subscription`

The ICS subscription is deliberately read-only and is **not** the canonical task store or authoritative execution writer. It must contain current/future AOS-owned events only and must never leak unrelated personal/manual calendar events.

If both Google sync and the ICS subscription are enabled, the same AOS event can appear twice in Apple Calendar. Google sync should therefore be the normal primary view, with ICS retained as fallback/portability unless duplicate display is acceptable.

## Recurring work

Recurring does not mean immortal. A recurring action must have:

- a reason for existence
- review cadence
- evidence/KPI state
- a next review date

When its review becomes due, the recurrence loses scheduling privilege until revalidated.

The live system prefers regenerating short-horizon one-off AOS blocks for adaptive work rather than creating permanent recurring calendar series. This preserves reprioritisation freedom and avoids immortal calendar debt.

## Missed work

Missed work is never automatically rolled forward. It re-enters relevance evaluation and may be rescheduled, superseded, merged, deferred or killed.

## Capacity policy

Normal mode protects 20% of workable time as slack. The engine schedules only the highest-ranked eligible actions into the remaining flexible capacity after hard commitments.

## Local run

```bash
node apps/agentic-os/run.mjs apps/agentic-os/fixtures/simulation.json
node apps/agentic-os/tests.mjs
```

Outputs are written beneath `apps/agentic-os/state/`.

## Safety

- Europe/London wall-clock handling is tested across BST and GMT
- deterministic/idempotent ownership IDs survive calendar movement
- real live update semantics have been verified against Google Calendar without duplicate creation
- no mutation of events without Agentic OS ownership markers
- duplicate owned live events fail closed instead of being guessed away
- ambiguous AOS-prefixed events fail closed
- the normal two-hour freeze window prevents thrashing of imminent work
- every terminal/merged/superseded state requires a reason
- terminal work cannot become the canonical merge target for live work
- satisfied dependency outcomes do not leave downstream work falsely blocked
- stale dependencies fail closed
- recurrence review can remove scheduling privilege
- passed deadlines never silently roll forward
- duplicate/family tasks collapse to one canonical action
- completed outcomes invalidate redundant remaining work
- public ICS is fallback only, never system of record
