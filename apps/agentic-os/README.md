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
- `run.mjs` — CLI orchestration entrypoint.
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
  "outcomes": []
}
```

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
- a generated ICS feed

Calendar blocks carry stable ownership metadata. A block keeps its Agentic OS identity when its time moves, so a live writer can update the existing event rather than create a duplicate.

Required live event markers are:

- title begins `AOS |`
- `AOS_OWNER=agentic-os`
- `AOS_ACTION_ID=<stable action id>`
- `AOS_BLOCK_ID=<stable block id>`

Manual/personal events are inputs to capacity planning and are never rewritten.

## Current live calendar architecture

The currently connected Google account exposes one primary calendar, `TRIPLE TWO EMAILS 🚀`. No dedicated secondary `AOS • EXECUTION` calendar is currently available through the connector.

Therefore the live ownership-safe path is:

`Agentic OS -> AOS-owned events on the Google primary calendar -> Google sync -> native Apple Calendar`

Only events carrying the explicit AOS ownership markers may be created, moved or removed by the system. Existing manual events and recurrences remain protected.

A dedicated secondary calendar remains a future isolation improvement if connector/account capability exposes one. The system must not pretend that calendar exists before it does.

## Runtime bridge

The deterministic repo engine does not contain Google OAuth credentials and does not independently call Google Calendar. Live source ingestion and live calendar reconciliation are currently performed by the existing **Agentic OS Omega Supervisor**, which has access to the connected sources/tools.

That supervisor must:

1. read current hard/manual calendar commitments
2. reconcile current task/outcome evidence
3. evaluate relevance, duplicates and supersession
4. rank only current executable work
5. reconcile existing AOS-owned events by stable action/block ID
6. fail closed on ambiguous ownership or unavailable connectors
7. preserve audit lineage for retired work

The repo engine remains the deterministic policy/test layer. The supervisor is the current live integration bridge. These roles must not be conflated.

## Apple Calendar and ICS

Primary editable path:

`Google Calendar account sync -> Apple Calendar`

Portable fallback:

`public/agentic-os.ics -> Apple Calendar subscription`

The ICS subscription is deliberately read-only and is **not** the canonical task store or authoritative execution writer. It must contain AOS-owned events only and must never leak unrelated personal/manual calendar events.

If both Google sync and the ICS subscription are enabled, the same AOS event can appear twice in Apple Calendar. Google sync should therefore be the normal primary view, with ICS retained as fallback/portability unless duplicate display is acceptable.

## Recurring work

Recurring does not mean immortal. A recurring action must have:

- a reason for existence
- review cadence
- evidence/KPI state
- a next review date

When its review becomes due, the recurrence loses scheduling privilege until revalidated.

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
- no mutation of events without Agentic OS ownership markers
- every terminal/merged/superseded state requires a reason
- terminal work cannot become the canonical merge target for live work
- satisfied dependency outcomes do not leave downstream work falsely blocked
- stale dependencies fail closed
- recurrence review can remove scheduling privilege
- passed deadlines never silently roll forward
- duplicate/family tasks collapse to one canonical action
- completed outcomes invalidate redundant remaining work
- public ICS is fallback only, never system of record
