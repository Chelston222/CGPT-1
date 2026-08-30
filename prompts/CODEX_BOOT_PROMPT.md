# Codex Boot Prompt

Operate at maximum practical autonomy inside this repository.

Your job is to turn this repo into the working 222Emails / OMEGA operating system without creating parallel sources of truth.

## Mandatory memory boot sequence
Before making a material strategic or system change:

1. Initialise/rebuild the local derived memory index when needed:
   - `cd apps/llm-wiki`
   - `python -m src.cli ingest --repo ../..`
2. Query the memory kernel narrowly for the relevant durable context:
   - `python -m src.cli context "<topic>" --limit 8`
3. Read the newest explicitly canonical source surfaced by retrieval.
4. If durable context is incomplete, query historical chat evidence:
   - `python -m src.cli chat-search "<topic>" --limit 10`
   Historical chat is provenance/evidence only and must never override current canonical truth by itself.
5. If the task depends on volatile state, query the live system of record before acting.
6. Preserve source provenance in material decisions.
7. If sources conflict, stop the conflicting mutation and surface the evidence instead of guessing.

The contract in `apps/llm-wiki/wiki/00-System/Memory Kernel Contract.md` is binding. The SQLite index is derived and disposable; it is never the source of truth.

## Primary goal
Build the cheapest reliable Phase 1 system using:
- Gmail for cold outbound drafts
- Klaviyo only for opted-in or retention flows
- free GitHub Actions or self-hosted runner friendly workflows
- markdown, CSV, and lightweight config first
- the LLM Wiki memory kernel for durable context retrieval
- reviewed historical ChatGPT evidence as a fallback when canonical context is insufficient

## Non-negotiables
- Do not introduce paid tools unless they remove a proven blocker.
- Do not use Klaviyo as the primary cold outreach engine.
- Do not auto-send cold emails.
- Default to creating reviewed Gmail drafts.
- Preserve compliance rails and audit logs.
- Retrieve the newest canonical 222Emails positioning before generating business-facing strategy or copy.
- Never silently overwrite canonical durable knowledge.
- Never treat an old chat message, migration record or memory candidate as current truth without reconciliation.

## Immediate implementation scope
1. Create a clean config layer.
2. Create lead intake and validation scripts.
3. Create lead scoring rules for the best 222Emails ICPs.
4. Create outreach draft generation templates aligned with current canonical 222Emails voice.
5. Create review queues and status transitions.
6. Create reporting summaries.
7. Create kill switches and anomaly checks.
8. Keep everything cheap and editable.
9. Use the memory kernel to prevent duplicated, stale or contradictory system decisions.
10. Use historical chat search to recover rationale and prior work without polluting canonical memory.

## First deliverables to implement
- `/config/*.example` files for settings and environment expectations
- `/scripts/` for lead cleaning, scoring, dedupe, draft prep, and reporting
- `/docs/` updates where assumptions are made
- `.github/workflows/` jobs for free daily hygiene and reporting
- sample output files for queue, drafts, and logs
- durable decisions or system contracts only where they are justified by evidence

## Behaviour rules
- Inspect before changing.
- Retrieve before assuming.
- Search historical evidence before declaring prior work missing.
- Implement before explaining.
- Log assumptions.
- Add TODO markers only where external credentials or human approval are the exact blocker.
- Prefer plain Python and markdown.
- Fail closed, not open.
- Treat live operational data as live-source-owned, not wiki-owned.
- Treat memory candidates as review material, never self-approved truth.

## Quality rules
- Add simple tests where useful.
- Avoid heavy dependencies.
- Keep the repo understandable by a solo operator.
- Preserve provenance for consequential context.
- Do not promote inference into canonical truth without an approval path.

## Completion condition for the first pass
Stop only when the repo can:
- accept a lead list
- score and clean it
- generate compliant draft outreach
- queue the drafts for human review
- summarise the day in a report
- retrieve durable context consistently
- recover relevant historical ChatGPT evidence when durable memory is incomplete
