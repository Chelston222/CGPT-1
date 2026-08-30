# Upwork Application OS

Turnkey application-prep engine for Chelston / 222Emails.

## Status

**GREEN: READY_TO_SUBMIT production mode.** Final completion regression suite passes. Final Upwork submission remains intentionally manual until official Upwork API access with proposal-submission permission is approved.

## Operating mode

The system may discover from permitted public sources, score, deduplicate, draft, QA, queue, export and track Upwork applications. It must not scrape Upwork, replay credentials, use headless/browser auto-clicking, or submit through unapproved automation.

`API_AUTO_SUBMIT` is fail-closed. `upwork_api.py` has no browser fallback and remains locked until official credentials and the live submission schema/scope are verified.

## Positioning

Headline outcome: Revenue Recovery / Client Return Systems.

Primary problems: unconverted enquiries, weak lead follow-up, cancellations/no-shows, rebooking leakage, dormant-client reactivation, lifecycle gaps, and CRM/email/SMS automation.

Implementation tools such as Klaviyo, Mailchimp, HubSpot, MailerLite and Make.com support the outcome rather than define the positioning. `profile-source-of-truth.md` is the proposal truth boundary.

## States

`DISCOVERED -> SCORED -> REJECTED | NEEDS_HUMAN_FACT | PROPOSAL_READY -> READY_TO_SUBMIT -> SUBMITTED -> REPLIED -> INTERVIEW -> WON | LOST | SUPPRESSED`

`status.py` enforces legal state transitions, permits suppression from any active pre-terminal state, and calculates submitted, reply, interview, win, Connect and revenue metrics.

## Scoring

100 points total: positioning fit 25, active pain/urgency 15, budget/effective rate 15, recurring/expansion potential 15, client quality 10, competitive timing 10, proof match 5, delivery feasibility 5.

Thresholds: 85-100 APEX, 75-84 STRONG, 65-74 SELECTIVE, below 65 REJECT.

## Hard gates

Stop when the job is closed, a duplicate active/submitted job exists, required facts cannot be verified, proof would need fabrication, capability exceeds evidence, or the role is an obvious prohibited/deceptive/bad-fit case.

## Live manual-submission loop

1. The 07:20 TTE Morning Action Pack discovers current Upwork opportunities from permitted public sources.
2. Candidate is normalised and scored against `config.json`.
3. Hard gates and duplicate protection run.
4. Proposal and visible screening answers are generated from verified facts only.
5. APEX/STRONG records become `READY_TO_SUBMIT`.
6. `export_ready.py` creates the minimal handoff: direct URL, bid, proposal and screening answers.
7. Chelston opens the direct URL, verifies the job is still open and performs the final Upwork submit action.
8. `status.py` advances the record through SUBMITTED, REPLIED, INTERVIEW, WON/LOST and captures commercial telemetry.
9. Performance evidence informs later scoring/template changes. Do not infer causality from tiny samples.

Warm replies and existing commitments in the Morning Action Pack always outrank cold Upwork applications.

## API activation gate

Before activation all must be true:
- official Upwork API access approved
- OAuth/access credentials stored outside repository
- Submit Proposal permission confirmed against current official documentation
- exact current GraphQL mutation/schema verified
- duplicate and job-open checks rerun immediately before submission
- no unresolved human facts or unsupported proof
- explicit `UPWORK_API_AUTO_SUBMIT=true`

Until then the correct state is READY_TO_SUBMIT, not a browser workaround.

## QA

`.github/workflows/upwork-os-qa.yml` compiles the module, runs unit tests and proves API submission fails closed by default on relevant pushes/PRs and once daily at 06:05 UTC as an integrity check. Core tests cover duplicate blocking, closed jobs, missing facts, unsupported proof, scoring, legal/illegal state transitions, suppression, telemetry and API fail-closed behaviour. The final completion regression run passed on 30 August 2026.

## Files

- `app.py`: scoring, gates, queue and dedupe
- `config.json`: weights, thresholds and safety settings
- `profile-source-of-truth.md`: positioning and factual claims boundary
- `queue.json`: persistent application ledger
- `export_ready.py`: manual-submit handoff
- `status.py`: lifecycle state machine and telemetry
- `upwork_api.py`: dormant official-API boundary
- `test_app.py`: regression tests

## Definition of green

Green means discovery/preparation can operate daily, weak/unsafe/duplicate jobs fail closed, proposals cannot rely on invented proof, the manual submission packet is turnkey, outcomes are trackable, and no unapproved Upwork automation is used. Automatic final submission is not considered a defect while official API eligibility is unavailable.
