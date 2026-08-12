# 222 Emails Flagship Klaviyo Proof System

Status: **HARDENING / NOT LIVE**  
Owner: 222 Emails  
Canonical flow: `TWM6Yx`  
Purpose: operate as a real lead-nurture and conversion system while serving as public proof of TTE lifecycle strategy, copy, design and delivery capability.

## Canonical account configuration

- Trigger list: `Email List` (`SjerhA`)
- Consent mode: `double_opt_in`
- Sender/reply-to: `hello@222emails.com`
- From label currently deployed: `Triple Two Emails`
- Conversion destination: 222 Emails Follow-Up Fit Check
- Fit Check URL: `https://form.jotform.com/262067771632056`
- Canonical flow ID: `TWM6Yx`
- Flow status: Draft until all automated and human launch gates pass

## Welcome journey

1. E01, Day 0: `Welcome to 222 Emails` — relationship / founder welcome
2. E02, Day 1: `5 places revenue quietly disappears` — problem awareness
3. E03, Day 3: `What we’d fix first in your email system` — method
4. E04, Day 5: `We built this instead of telling you we could` — proof
5. E05, Day 7: `Want us to find the leaks?` — conversion

Core progression: **Relationship -> Problem -> Method -> Proof -> Conversion**.

## Current automated QA

The live Klaviyo API verifier checks the canonical flow structure, timing, subjects, sender/reply-to, message statuses, expected template content, unsubscribe mechanism, placeholder links and Fit Check destinations.

`launch_readiness.py` adds hard launch gates for the canonical flow/list/consent identity and the intended Smart Sending policy.

### Smart Sending policy

- E01: OFF. The immediate post-opt-in welcome is intended to arrive even when the subscriber recently received another marketing email.
- E02-E05: ON. Later nurture messages may respect Smart Sending to reduce collision with other marketing sends.

The currently deployed `TWM6Yx` was originally created with Smart Sending ON for all five messages. That is now treated as a launch blocker. Do not activate `TWM6Yx` until the canonical flow has been rebuilt or corrected to match the policy and passes the strengthened launch gate.

## Critical unresolved gates

These are not cosmetic. Production remains blocked until they are resolved.

1. **V3 brand compliance**
   - Designed emails currently use a legacy teal visual treatment and typed `TTE` shorthand.
   - Final designed messages must use the real V3 222 Emails logo and V3 palette.
   - W01 may remain intentionally plain/founder-style; this exception must not be used to justify fake logo treatment in designed emails.

2. **Public capture path**
   - Verify or create a real public signup surface that subscribes permissioned prospects to `Email List` (`SjerhA`).
   - A perfect flow with no verified acquisition path is not a functioning funnel.

3. **Fit Check / client exit logic**
   - The source architecture requires sales-oriented welcome messages to stop when an audit is requested or a profile becomes a client.
   - The canonical flow currently has no verified Fit Check submission event/property or client exclusion wired into the flow definition.
   - Production activation is blocked until a reliable event/property bridge and exit/suppression rule are verified.

4. **Human rendering and inbox QA**
   - Desktop, mobile and dark-mode review.
   - Seed inbox delivery, links and reply behaviour.
   - Sending-domain authentication health.
   - Fit Check end-to-end form submission.

5. **Measurement event**
   - Fit Check completion and qualified commercial progression need a verified Klaviyo event/property path so the North Star can be measured beyond opens/clicks.

## Deployment architecture

`Strategy & Copy -> GitHub Source -> GitHub Actions -> Klaviyo API -> Draft -> Automated QA -> Human QA -> Manual Canary -> Live`

### Template deployment

`deploy_templates.py` is idempotent. It searches by exact canonical template name, PATCHes the existing template when found, and POSTs only when missing. Each CODE template includes HTML plus a generated plaintext counterpart.

### Production safety

- `.github/workflows/tte-klaviyo-go-live.yml` is manual only.
- It runs `verify_flagship_flow.py` and `launch_readiness.py` immediately before any activation attempt.
- It requires PASS for visual, seed, domain, Fit Check, capture and exit QA.
- It also requires the exact typed phrase `GO-LIVE-TWM6Yx`.

### Canary mode

`.github/workflows/tte-klaviyo-canary-manual.yml` can move the canonical flow to Manual mode only after minimum QA. Manual mode is intended for review-required canary operation before automatic sending.

### Emergency stop

`.github/workflows/tte-klaviyo-emergency-stop.yml` can return the canonical flow to Draft using the exact typed phrase `SET-TWM6Yx-DRAFT`.

## Source of truth

- Strategy/operating model: `ENGINE.md`
- Live status and gaps: `STATUS.md`
- Templates: `templates/`
- Full API verifier: `verify_flagship_flow.py`
- Launch gate: `launch_readiness.py`
- Controlled activation: `activate_flagship_flow.py`
- Canary/rollback status controller: `set_flagship_status.py`

## Non-negotiable governance

No real send without final QA. Do not bypass capture, exit/suppression, domain, rendering or Fit Check validation simply because the API structure passes. The purpose of automation is to increase repeatability and safety, not to remove commercial judgement at the production boundary.
