# 222Emails Klaviyo Production Rubric

Last source audit: 1 September 2026

This rubric separates **repository/source quality** from **end-to-end production readiness**. A passing source test, a successful draft deployment or a high QA score is never enough to describe the system as live or working.

## Hard gates

Any unresolved item below blocks production activation regardless of weighted score:

- Canonical candidate `VbBAhU` is not Draft immediately before production QA.
- Current source QA fails.
- Current live-account verification fails against the Email Revenue OS subjects, copy markers, sender identity, Smart Sending policy and Tally route.
- Public double-opt-in capture into `Email List` (`SjerhA`) is unverified.
- Free Revenue Recovery Check completion cannot be attributed through a verified event/property route.
- Qualified-opportunity/client exit or suppression logic is unverified.
- SPF, DKIM and DMARC state/alignment for the actual sending configuration is unverified.
- Provider-compatible one-click unsubscribe is unverified for promotional mail where applicable.
- Visible unsubscribe behaviour is unverified.
- Complaint and bounce monitoring plus an owner/action threshold is unverified.
- Desktop, mobile and dark-mode visual QA is unverified.
- Seed inbox placement, links and reply behaviour is unverified.
- The Tally Free Revenue Recovery Check is unverified end to end.
- A controlled manual canary has not been observed.
- Explicit typed human go-live approval is absent.

## Source-quality rubric

| Dimension | Weight | Green definition |
|---|---:|---|
| Commercial logic | 15 | Client Return System positioning and one clear commercial job per message. |
| Email Revenue OS copy | 15 | Current sequence, truthful opening, useful value, one central idea and stage-fit CTA. |
| Lifecycle logic | 15 | Trigger, delays, Smart Sending and exit/suppression architecture are coherent. |
| Brand and accessibility | 10 | `222Emails` spelling, V3 source assets, no em dash, readable current-facing copy. |
| Proof and claims | 10 | No fabricated results, guarantees, urgency or unsupported live/winner claims. |
| Deliverability/compliance source | 10 | Consent, unsubscribe, sender/reply-to and launch gates are represented correctly. |
| Infrastructure/safety | 10 | Draft-first writes, manual activation, emergency stop, idempotence and read-only verification. |
| Capture/diagnostic continuity | 5 | Current Tally route and permissioned capture source are represented without legacy Jotform dependence. |
| Measurement/lineage | 5 | UTM/experiment/event requirements and evidence hierarchy are explicit. |
| Non-regression | 5 | No obsolete candidate, route, brand or automatic production-write path silently reappears. |

Repository target: **>=95/100 and zero source hard fails**.

## Production-readiness rubric

Production green requires direct evidence, not source assertions, for all hard gates above. Until then the production status remains **BLOCKED / NOT VERIFIED**, even when repository CI is completely green.

## Current release order

1. Merge only after all applicable PR CI passes and the complete diff audit is clean.
2. Run the manual Draft template deployment workflow.
3. Verify the real Klaviyo candidate from the API.
4. Establish and verify the current Tally completion/attribution event route.
5. Verify capture and exit/suppression logic.
6. Verify authentication, unsubscribe, complaint/bounce and seed-inbox behaviour.
7. Run rendering QA and end-to-end Tally submission.
8. Run a controlled manual canary.
9. Activate only through the manual go-live workflow with every gate marked PASS and the exact confirmation phrase.

The former `TWM6Yx` proof-build and Jotform Fit Check route are historical only and must not be reactivated as current production dependencies.
