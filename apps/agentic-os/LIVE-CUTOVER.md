# Agentic OS Calendar Lane — Live Production Cutover

**Cutover date:** 30 August 2026  
**Timezone:** Europe/London  
**Status:** Production green for the current connected-tool architecture

## Live architecture

Authoritative execution path:

`Agentic OS -> Google Calendar primary calendar -> Google sync -> Apple Calendar`

The authenticated Google account currently exposes one primary calendar, `TRIPLE TWO EMAILS 🚀`. A dedicated secondary AOS calendar is not exposed by the current connector, so isolation is enforced by strict event ownership rather than by calendar container.

Fallback path:

`AOS-owned Google events -> apps/agentic-os/public/agentic-os.ics -> read-only Apple Calendar subscription`

Google Calendar remains authoritative. The ICS feed is never the control plane.

## Ownership boundary

An event is writable by Agentic OS only when all required ownership evidence is unambiguous:

- title begins `AOS |`
- description contains `AOS_OWNER=agentic-os`
- description contains a stable `AOS_ACTION_ID`
- multi-segment actions also require a stable `AOS_BLOCK_ID`

Manual, personal and ambiguous events are never mutated. `AOS |` without complete ownership evidence is a blocker, not permission.

## Live production evidence

### Apple Calendar sync

The user confirmed in Apple Calendar that the Google-synchronised `AOS | CEO START` event appeared correctly alongside existing manual/personal events. This proves the native Apple view is receiving the live Google control plane.

### Protected manual recurrence

`Founder Story + Photo Capture` remains a manual recurring event at 08:00–08:15 Europe/London under recurring master `jlp9likqdt7j4mnlu4rn25j5qg`. Post-cutover searches confirmed its future instances remain present and unchanged. It is not AOS-owned.

### Live AOS execution events at cutover

The live Google primary calendar contains these current/future owned events:

| Event | Google event ID | Stable action ID | Time Europe/London |
| --- | --- | --- | --- |
| AOS \| BUILD / DELIVER | `0pgcpla0ghl446q30g2hsqf5m4` | `aos-100k-fleet-human-2026-08-30` | 30 Aug 09:00–10:00 |
| AOS \| CEO START | `g9051045b29ghvb1doh8faguhk` | `aos-ceo-start-2026-08-31` | 31 Aug 07:20–07:40 |
| AOS \| CEO START | `pmh14g03o97o3spab8osoqhc84` | `aos-ceo-start-2026-09-01` | 1 Sep 07:20–07:40 |
| AOS \| CEO START | `5ebhou95v0rklr8v9isbfu6fjs` | `aos-ceo-start-2026-09-02` | 2 Sep 07:20–07:40 |

A bounded 14-day live search returned unique action identities with no duplicate owned action at cutover.

### Real reschedule/idempotency canary

Google event `g9051045b29ghvb1doh8faguhk` was moved from 07:20–07:40 to 07:25–07:45 and then restored to 07:20–07:40.

The Google event ID remained unchanged throughout. A fresh search returned exactly one event for the action. This proves the live writer path can move an existing owned event without duplicate creation.

## Deterministic implementation

- `engine.mjs` implements relevance, supersession, dedupe, dynamic priority, stale-evidence degradation, dependency handling, missed-work revalidation and recurring-contract lifecycle decisions.
- `calendar.mjs` implements Europe/London-aware capacity planning, hard-event collision avoidance, stable block identity and 20% normal slack.
- `reconcile.mjs` implements ownership-safe create/update/delete/no-op/retain/block decisions.
- `run.mjs` emits both desired execution state and the deterministic live reconciliation diff.
- `tests.mjs` exercises the complete acceptance gate.

## Acceptance coverage

Green-gate coverage includes:

- old task superseded/merged into a newer canonical action
- duplicate family collapse
- missed work revalidated before rescheduling
- completed outcome invalidating redundant children
- passed deadline fail-closed
- recurring contract: continue, reduce, pause and retire
- warm/high-value work displacing lower-value flexible work
- hard/manual commitment collision protection
- idempotent planning and stable event identity
- manual event mutation protection
- ambiguous or duplicate AOS ownership fail-closed
- two-hour normal freeze-window retention
- 20% normal capacity buffer
- audit reason for terminal lifecycle decisions
- stale source/integration state losing execution privilege
- current/future AOS-only fallback ICS filtering
- BST/GMT wall-clock correctness
- bounded 21-day repeated-miss/supersession simulation with no runaway live backlog

## CI evidence

Agentic OS Green Gate run `33299899799` on commit `855353b0ab8d9b515dde566551a226b1939296b4` completed successfully after the final lifecycle acceptance tests were added.

The workflow also requires generated `latest.json`, `reconciliation.json` and `execution.ics` evidence and fails if reconciliation health is red.

## Live supervisor

The existing `Agentic OS Omega Supervisor` is the integration bridge. No new ChatGPT task was created.

It runs every four hours and is contractually required to:

1. reconcile current sources and hard commitments
2. re-evaluate relevance and supersession
3. compute dynamic priority and protected capacity
4. apply the deterministic ownership-safe calendar contract
5. maintain a short three-day adaptive CEO START horizon when still justified and conflict-free
6. verify affected events after writes
7. refresh the 14-day AOS-only fallback ICS after successful calendar verification
8. fail closed and surface exact blockers when a connector or ownership condition is unsafe

## Remaining external constraint

There is no known open implementation hole in the current scope. One external architecture limitation remains: the Google Calendar connector/account exposes only the primary calendar, so a physically separate `AOS • EXECUTION` secondary calendar cannot currently be used.

This does not block safe production operation because ownership isolation is enforced at event level and covered by deterministic tests. If secondary-calendar creation becomes available later, migration is an isolation improvement, not a prerequisite for current correctness.

## Production gate

The calendar lane is considered green when:

- task-state health is green
- reconciliation health is green
- live AOS action IDs are unique in the checked horizon
- no manual event was mutated
- writes are reread/researched successfully
- hard commitments remain collision-free
- Europe/London wall-clock semantics are correct
- protected slack is respected where applicable
- fallback ICS contains owned events only

Any failed condition makes the calendar lane red even if the rest of Agentic OS remains operational.
