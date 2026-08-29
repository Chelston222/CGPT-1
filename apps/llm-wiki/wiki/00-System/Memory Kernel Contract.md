---
type: system_contract
status: CURRENT CANONICAL
owner: 222Emails
updated: 2026-08-29
---

# Memory Kernel Contract

## Purpose

The LLM Wiki is the durable memory kernel beneath the OMEGA / 222Emails operating system. It exists to stop strategic drift, repeated rediscovery, contradictory instructions and uncontrolled agent memory.

## Truth hierarchy

When sources disagree, use this order unless a domain-specific canonical pointer explicitly overrides it:

1. **Live system of record for volatile state**: inbox, calendar, CRM/queue, deployment/runtime, payment platform, analytics or other operational source.
2. **Newest explicitly canonical durable source**: a current machine context, master context pointer, constitution or approved decision record.
3. **Approved wiki synthesis**: a page marked `CURRENT CANONICAL` with provenance.
4. **Repository documentation and historical records**.
5. **Inference**: may guide investigation but must never be silently promoted to fact.

## Durable vs live knowledge

Durable examples:

- positioning
- offer architecture
- ICP definitions
- compliance rules
- brand rules
- playbooks
- decision rationale
- system contracts

Live examples:

- prospect status
- reply state
- sender health
- Buffer queue
- pricing currently published on a live checkout
- availability
- deployment health
- campaign performance

The wiki may index a snapshot of live material for discovery, but an agent must re-query the live source before acting on volatile state.

## Ingestion rules

1. Raw source content is immutable during ingestion.
2. Every indexed document gets a content hash and source path.
3. Retrieval chunks retain source path, heading and line range.
4. Generated databases and caches are disposable and never canonical.
5. Secrets, credentials, tokens, private runtime files and binary media are excluded by default.
6. Deleted source files are removed from the derived index on the next successful ingest.

## Write policy

### Read
Agents may retrieve approved indexed context.

### Propose
Agents may generate a proposed new decision, page or correction with cited provenance.

### Commit
Canonical durable knowledge should only be committed when an explicit workflow or human-approved rule authorises the mutation.

### Never silently overwrite
An agent must not silently rewrite a canonical fact merely because a newer source appears different. It should flag the conflict, identify both sources and route the change through the appropriate approval gate.

## Retrieval contract

For each material answer or action:

1. Form a narrow query.
2. Retrieve only the most relevant chunks.
3. Prefer canonical/current material over historical material when both are present.
4. Preserve provenance.
5. If the question concerns live state, verify it at source.
6. If evidence is insufficient or contradictory, report that rather than inventing continuity.

## Lint contract

The lint loop should progressively detect:

- malformed source data
- duplicate titles
- unresolved wiki links
- stale canonical documents
- conflicting canonical claims
- orphan pages
- missing provenance
- superseded decisions still referenced as current

Structural linting ships in v1. Semantic contradiction detection is a later model-assisted layer and must preserve evidence for every flagged conflict.

## Agent-facing rule

> Retrieve durable context from the memory kernel. Verify volatile state at the live source. Carry provenance into decisions. Never guess across conflicts. Never silently mutate canonical truth.

## Relationship to existing safety rails

This contract does not weaken any existing 222Emails review, compliance, duplicate-contact or send gates. Memory improves context; it does not grant new authority to act.
