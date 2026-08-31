# Agentic OS — Autonomous Executive Orchestration

Agentic OS is the outcome-first control plane for Chelston's work and time.

It exists to prevent backlog accumulation, stale recurring work, duplicate effort, asset/version drift and calendar drift.

## Core contract

The system does **not** ask "what is unfinished?" and blindly carry it forward.

It asks:

1. What outcome is still required?
2. What has changed since this action was created?
3. Has another action, decision or artefact superseded it?
4. Is the action duplicated or already satisfied?
5. Is it executable now?
6. Is it still the highest-value use of scarce time?
7. Is the file/system being relied upon still the current authority?

Every task candidate resolves to one of:

`EXECUTE | SCHEDULE | MERGE | SUPERSEDED | OBSOLETE | BLOCKED | DELEGATE | DEFER | KILL`

Every governed asset resolves to one of:

`CURRENT_CANONICAL | LIVE_OPERATOR | SUPPORTING | REPAIR_REQUIRED | REVALIDATE | DUPLICATE | SUPERSEDED | DORMANT | ARCHIVE`

## Files

- `config.json` — operating policy, scoring weights and decay windows.
- `engine.mjs` — deterministic relevance, supersession, recurrence and priority engine.
- `asset-governance.mjs` — asset/project authority, duplicate, drift and freshness governance pre-layer.
- `calendar.mjs` — collision-safe, Europe/London-aware capacity planner and RFC5545 ICS renderer.
- `reconcile.mjs` — ownership-safe live calendar diff: create, update, delete, no-op, retain or fail closed.
- `run.mjs` — CLI orchestration entrypoint that emits asset state, task state, plan and reconciliation evidence.
- `fixtures/simulation.json` — changing multi-day workload acceptance fixture.
- `fixtures/asset-governance.json` — asset-governance acceptance fixture based on current operating-system problem classes.
- `tests.mjs` — task/calendar regression and acceptance suite.
- `asset-governance-tests.mjs` — asset authority, drift, stale-state and duplicate-family acceptance suite.
- `public/agentic-os.ics` — public read-only Apple Calendar fallback feed.

## Input contract

`run.mjs` accepts a JSON state file containing:

```json
{
  "now": "2026-08-30T08:00:00+01:00",
  "tasks": [],
  "assets": [],
  "assetPolicy": {
    "liveAssetStaleHours": 168
  },
  "hardCommitments": [],
  "outcomes": [],
  "existingCalendarEvents": [],
  "freezeWindowMinutes": 120
}
```

`existingCalendarEvents` is optional. When supplied, the run emits an ownership-safe reconciliation diff against the desired AOS execution blocks. When omitted, the reconciliation layer correctly reports the desired owned blocks as creates without touching anything externally.

`assets` is also optional. When supplied, Asset Governance is evaluated before task ranking. Repair, revalidation and duplicate-consolidation work is converted into ordinary AOS tasks and therefore competes for time through the same priority/capacity engine rather than creating a second backlog.

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

Important asset fields include:

- `id`
- `title`
- `source`
- `url`
- `version`
- `familyId` / `canonicalFor`
- `authorityLevel`
- `status`
- `supersededBy`
- `lastVerifiedAt`
- `modifiedAt`
- `sourceFresh`
- `driftSignals`
- `archive` / `rollbackOnly`

## Asset + Project Governance

Asset Governance is deliberately a **pre-layer**, not a second operating system.

Architecture:

`Drive / GitHub / Docs / Sheets / specialist systems -> Asset Governance -> existing AOS task/outcome graph -> priority/capacity -> EXECUTE + Calendar`

Rules:

- backups and rollback files are preserved but can never become execution authority
- explicit supersession lineage is preserved
- one current-canonical claim is permitted per asset family
- multiple current-canonical claims fail asset health closed as `CANONICAL_CONFLICT`
- duplicate non-canonical members become `DUPLICATE`
- known operating drift becomes `REPAIR_REQUIRED`
- stale live/operator authority becomes `REVALIDATE`
- repair/revalidation/consolidation needs emit one bounded AOS task each
- ordinary repair debt does not make the whole AOS red; true authority ambiguity does
- historical assets remain available for audit and rollback

The active projection intentionally excludes `SUPERSEDED`, `DORMANT` and `ARCHIVE` assets. This gives human-facing surfaces a clean "what is live now" view without deleting history.

### Specialist-system boundary

AOS governs **whether a system is current, healthy, stale, duplicated or superseded**. It does not swallow the specialist system's internal operating logic.

Examples:

- Commercial Command Centre remains the 222Emails commercial operating system.
- Follow the Sun remains a specialist outbound engine.
- Chelsi remains a client-delivery system.
- Visual OS remains the design-production authority.
- Content/Hook systems remain specialist content systems.

AOS owns the cross-system questions: current authority, health, supersession, dependencies, priority and next executive action.

### Legacy Drive command centre

`Chelston Live Command Centre - Projects, Cleanup and Execution OS` is a legacy/projection surface, not the canonical AOS control plane. It may be refreshed from AOS state for human readability, but it must never independently override repo-governed AOS task/asset state or current canonical business contexts.

## Output contract

The engine emits:

- canonical asset states and active asset projection
- asset-governance health and blockers
- generated repair/revalidation/consolidation tasks
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
- `asset-governance.json`
- `reconciliation.json`
- `execution.ics`

The Green Gate fails if task-state health, asset-authority health or calendar-reconciliation health is red.

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

The deterministic repo engine does not contain Google OAuth credentials and does not independently call Google Calendar or Google Drive. Live source ingestion and live reconciliation are performed by the existing **Agentic OS Omega Supervisor**, which uses the connected Calendar, Drive, GitHub and other authorised sources.

That supervisor must:

1. read current hard/manual calendar commitments
2. ingest current task/outcome evidence
3. ingest governed asset/system evidence from authorised sources
4. reconcile current canonical asset families, duplicates, freshness and drift signals
5. evaluate task relevance, duplicates and supersession
6. rank only current executable work, including bounded governance repair work
7. apply the `reconcile.mjs` ownership contract to existing AOS-owned events
8. fail closed on duplicate or ambiguous ownership
9. preserve the two-hour freeze window under normal conditions
10. preserve audit lineage for retired work and superseded assets
11. regenerate the public fallback ICS from current/future AOS-owned events only after a successful live reconciliation
12. never manufacture completion or asset authority when a connector/write is unavailable

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
node apps/agentic-os/tests.mjs
node apps/agentic-os/asset-governance-tests.mjs
node apps/agentic-os/run.mjs apps/agentic-os/fixtures/simulation.json
```

Outputs are written beneath `apps/agentic-os/state/`.

## Safety

- Europe/London wall-clock handling is tested across BST and GMT
- deterministic/idempotent ownership IDs survive calendar movement
- real live update semantics have been verified against Google Calendar without duplicate creation
- no mutation of events without Agentic OS ownership markers
- duplicate owned live events fail closed instead of being guessed away
- ambiguous AOS-prefixed events fail closed
- multiple current-canonical asset claims fail closed
- archive/rollback assets cannot emit operational work
- repair/revalidation debt is surfaced as bounded work rather than silently trusted
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
