# 222Emails Systems Constitution

Tag: 222 Emails

## Mission
Build a calm, trusted, AI-assisted retention and outbound engine that helps local service businesses fill quieter weeks, bring past clients back, and reduce booking leakage.

## Definition of done
A working Phase 1 system should:
- hold a clean lead queue
- qualify leads against a defined ICP
- generate outreach drafts with the right 222Emails framing
- separate cold outbound from retention traffic
- create reviewable Gmail drafts
- maintain logs and compliance rails
- run free or near-free infrastructure first

## Business identity
222Emails is not positioned as generic email marketing.
It is positioned as a repeat-bookings and retention system.

## Primary offers to keep in mind
- Fit Check
- Repeat-Booking Engine
- Win-back and retention support
- installed once and runs in the background framing

## Phase map
### Phase 0
Manual and assisted.
- single inbox
- single lead queue
- manual review of all outbound drafts
- no auto-send
- free scheduling only

### Phase 1
Semi-automated.
- lead qualification pipeline
- draft generation pipeline
- basic reply handling support
- basic reporting
- strict review gates

### Phase 2
Higher leverage.
- richer CRM sync
- segmented flows
- reply classification
- content reuse engine
- better experimentation loops

## Golden operating rules
1. Cheap first.
2. Compliance first.
3. Draft first.
4. Personalisation before scale.
5. Human strategy, machine execution.

## Durable memory kernel
The LLM Wiki under `apps/llm-wiki` is the durable memory layer beneath the operating system.

Memory rules:
- Markdown and approved machine-readable context remain the durable source of truth.
- SQLite/search indexes are derived and disposable, never canonical.
- Agents retrieve durable context from the memory kernel before relying on ad-hoc recollection.
- Volatile operational facts must be verified at their live system of record before action.
- Retrieved context must preserve source provenance.
- Conflicts are surfaced for resolution; canonical truth is never silently overwritten.
- Agent writes to durable canonical knowledge are proposal-first unless an explicit approved workflow grants commit authority.
- The memory layer does not weaken any compliance, duplicate-contact, legal or send review gate.

See `apps/llm-wiki/wiki/00-System/Memory Kernel Contract.md`.

## Data contracts
### Lead record
Required fields:
- business_name
- contact_name if known
- website
- city
- sector
- company_type
- email
- source
- status
- notes
- last_checked_at

### Outreach record
Required fields:
- lead_id
- campaign_name
- draft_subject
- draft_body
- created_at
- reviewed_by
- sent_at
- outcome

### Audit record
Required fields:
- timestamp
- system_step
- input_ref
- action_taken
- result
- error_if_any

## Compliance rails
### Allowed by default
- corporate B2B outreach with clear identity and opt-out
- retention messaging to client-owned opted-in lists

### Not allowed by default
- blind auto-send to uncertain legal categories
- using Klaviyo for raw cold acquisition
- invisible identity or no unsubscribe path

## Review gates
A message can move from generated to sendable only if:
- the ICP fit is clear
- the category is acceptable
- the personalisation is grounded in real observations
- the opt-out is present
- no duplicate contact risk exists

## Core loops
### Daily loop
- refresh lead queue
- validate statuses
- generate top draft candidates
- surface highest-leverage drafts for review

### Weekly loop
- assess replies
- assess booked calls
- review deliverability and unsubscribe signals
- refine ICP and messaging

### Monthly loop
- retire weak campaigns
- promote strong patterns into templates
- review tooling and costs

## Kill switches
The system must stop outbound generation or sending when:
- Gmail quota risk is detected
- bounce or complaint signals rise materially
- duplicate detection fails
- compliance classification is uncertain
- data source quality drops below threshold

## Codex execution posture
Codex should be used to:
- implement repo structure
- build scripts and workflows
- improve prompts
- maintain documentation
- harden logging and review gates

Codex should not be trusted by default to:
- infer legal certainty from thin data
- auto-send without explicit rules
- create claims that are not evidence-based

## Success metrics
Track:
- drafts generated
- drafts approved
- sends made
- replies
- positive replies
- calls booked
- conversion to client
- unsubscribe rate
- bounce signals

## Cheapest launch truth
The first working version is not a fully autonomous army.
It is a disciplined, semi-automated operating system with strong handoff points.
That is the right first version.
