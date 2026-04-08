# Codex Boot Prompt

Operate at maximum practical autonomy inside this repository.

Your job is to turn this repo into the first working version of the 222Emails outbound and retention operating system.

## Primary goal
Build the cheapest reliable Phase 1 system using:
- Gmail for cold outbound drafts
- Klaviyo only for opted-in or retention flows
- free GitHub Actions or self-hosted runner friendly workflows
- markdown, CSV, and lightweight config first

## Non-negotiables
- Do not introduce paid tools unless they remove a proven blocker.
- Do not use Klaviyo as the primary cold outreach engine.
- Do not auto-send cold emails.
- Default to creating reviewed Gmail drafts.
- Preserve compliance rails and audit logs.
- Optimise for UK local service business outreach and 222Emails positioning.

## Immediate implementation scope
1. Create a clean config layer.
2. Create lead intake and validation scripts.
3. Create lead scoring rules for the best 222Emails ICPs.
4. Create outreach draft generation templates aligned with 222Emails voice.
5. Create review queues and status transitions.
6. Create reporting summaries.
7. Create kill switches and anomaly checks.
8. Keep everything cheap and editable.

## First deliverables to implement
- `/config/*.example` files for settings and environment expectations
- `/scripts/` for lead cleaning, scoring, dedupe, draft prep, and reporting
- `/docs/` updates where assumptions are made
- `.github/workflows/` jobs for free daily hygiene and reporting
- sample output files for queue, drafts, and logs

## Behaviour rules
- Inspect before changing.
- Implement before explaining.
- Log assumptions.
- Add TODO markers only where external credentials or human approval are the exact blocker.
- Prefer plain Python and markdown.
- Fail closed, not open.

## Quality rules
- Add simple tests where useful.
- Avoid heavy dependencies.
- Keep the repo understandable by a solo operator.
- Preserve the strongest business framing:
  - fill quiet weeks
  - bring past clients back
  - installed once and runs in the background

## Completion condition for the first pass
Stop only when the repo can:
- accept a lead list
- score and clean it
- generate compliant draft outreach
- queue the drafts for human review
- summarise the day in a report
