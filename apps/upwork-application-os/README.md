# Upwork Application OS

Turnkey application-prep engine for Chelston / 222Emails.

## Status

**GREEN: READY_TO_SUBMIT production mode.** Final completion regression suite passes. Final Upwork submission remains intentionally manual until official Upwork API access with proposal-submission permission is approved.

## Operating mode

The system may discover from permitted public sources, score, deduplicate, draft, QA, queue, export and track Upwork applications. It must not scrape Upwork, replay credentials, use headless/browser auto-clicking, or submit through unapproved automation. `API_AUTO_SUBMIT` is fail-closed and has no browser fallback.

## Positioning

Headline outcome: Revenue Recovery / Client Return Systems. Primary problems: unconverted enquiries, weak lead follow-up, cancellations/no-shows, rebooking leakage, dormant-client reactivation, lifecycle gaps, and CRM/email/SMS automation. Implementation tools support the outcome rather than define it. `profile-source-of-truth.md` is the factual boundary.

## States and telemetry

`DISCOVERED -> SCORED -> REJECTED | NEEDS_HUMAN_FACT | PROPOSAL_READY -> READY_TO_SUBMIT -> SUBMITTED -> REPLIED -> INTERVIEW -> WON | LOST | SUPPRESSED`

`status.py` enforces legal transitions, permits suppression from active states, and calculates submitted, reply, interview, win, Connect and revenue metrics.

## Scoring

100 points: positioning fit 25, active pain/urgency 15, budget/effective rate 15, recurring/expansion 15, client quality 10, competitive timing 10, proof match 5, delivery feasibility 5. Thresholds: 85 APEX, 75 STRONG, 65 SELECTIVE, below 65 REJECT.

## Hard gates and dedupe

Stop when the job is closed, the canonical job has ever entered the ledger, required facts cannot be verified, proof would need fabrication, capability exceeds evidence, or the role is prohibited/deceptive/bad fit. Upwork `~job` tokens are canonicalised independently of query strings, trailing slashes and discovery-source external IDs. Dedupe is state-agnostic, so even rejected, won, lost or suppressed history cannot silently re-enter the pipeline.

## Live loop

1. The 07:20 TTE Morning Action Pack discovers current Upwork opportunities from permitted public sources.
2. Candidate is normalised, scored and hard-gated.
3. Proposal and visible screening answers use verified facts only.
4. APEX/STRONG records become `READY_TO_SUBMIT`.
5. `export_ready.py` creates the minimal handoff with direct URL, bid, proposal and screening answers.
6. Chelston verifies the job is still open and performs the final Upwork submit action.
7. `status.py` tracks SUBMITTED, REPLIED, INTERVIEW, WON/LOST and commercial telemetry.
8. Performance evidence can later tune scoring/templates without inventing causality.

Warm replies and existing commitments always outrank cold Upwork applications.

## API activation gate

Before activation: official Upwork API access approved; credentials outside repo; Submit Proposal permission confirmed against current official documentation; exact live mutation/schema verified; duplicate and job-open checks rerun immediately before submission; no unresolved human facts/proof; explicit `UPWORK_API_AUTO_SUBMIT=true`. Until then READY_TO_SUBMIT is the correct production state.

## QA

`.github/workflows/upwork-os-qa.yml` compiles, runs unit tests and proves API submission fails closed on relevant pushes/PRs and daily at 06:05 UTC. Tests cover canonical URL identity, permanent duplicate blocking, terminal history, closed jobs, missing facts, unsupported proof, scoring, legal/illegal transitions, suppression, telemetry and API fail-closed behaviour. The canonical-dedupe regression passed on 30 August 2026.

## Files

`app.py` scoring/gates/dedupe; `config.json` production controls; `profile-source-of-truth.md` factual boundary; `queue.json` ledger; `export_ready.py` handoff; `status.py` lifecycle/telemetry; `upwork_api.py` dormant official API boundary; `test_app.py` regression suite.

## Definition of green

Discovery/preparation operates daily; weak, unsafe and duplicate jobs fail closed; proposals cannot rely on invented proof; manual submission packets are turnkey; outcomes are trackable; no unapproved Upwork automation is used. Automatic final submission is intentionally gated by official API eligibility and is not an outstanding implementation defect.
