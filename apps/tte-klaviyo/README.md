# 222Emails Flagship Klaviyo System

Status: **HARDENING / NOT LIVE**

This folder contains the permissioned owned-email proof and nurture system for 222Emails. The commercial category is Client Return Systems, not generic email marketing.

## Canonical account identity
- Current production candidate: `VbBAhU`
- Candidate name: `TTE Flagship Welcome Series | APEX V2 | PRE-LIVE`
- Former `TWM6Yx`: legacy proof-build candidate only, never activate
- Trigger list: `Email List` (`SjerhA`)
- Consent mode: double opt-in
- Sender/reply-to: `hello@222emails.com`
- Diagnostic: Free Revenue Recovery Check
- Current diagnostic route: `https://tally.so/r/44057b`

## Welcome journey
1. E01 `Welcome to 222Emails`
2. E02 `You already paid to acquire them`
3. E03 `The appointment cliff`
4. E04 `What a Client Return System actually does`
5. E05 `Where are your bookings slipping away?`

The source follows Email Revenue OS. One message can educate without a CTA. E05 carries the primary diagnostic conversion.

## Source of truth
- Strategy and operating model: `ENGINE.md`
- Current implementation state: `STATUS.md`
- Templates: `templates/`
- Static source gate: `source_audit.py`
- Live-account verifier: `verify_apex_v2_flow.py`
- Launch gate: `launch_readiness.py`
- Controlled activation: `activate_flagship_flow.py`
- Canary and rollback controllers remain separate from normal source deployment.

## Safety architecture
Draft deployment and live activation are separate operations. Source changes do not authorise activation. The manual go-live workflow requires automated verification immediately before activation, explicit human/external PASS inputs and an exact typed confirmation phrase.

The old Jotform-based Fit Check bridge is retired. It must not be treated as a current attribution path. A verified Tally-compatible completion/event route must exist before the production exit/measurement gate can pass.

## Hard production gates
- Current templates and live candidate match canonical brand, subjects, sequence and route.
- Public double-opt-in capture path verified.
- Free Revenue Recovery Check event/attribution route verified.
- Client/qualified-opportunity exit or suppression verified.
- Desktop, mobile and dark-mode rendering verified.
- Seed inbox placement, links and replies verified.
- SPF, DKIM and DMARC verified for the actual sender configuration.
- Provider-compatible one-click unsubscribe and visible unsubscribe verified where applicable.
- Complaint/bounce monitoring verified.
- Tally route works end to end.
- Explicit go-live authorisation supplied.

Configured is not working. Draft is not live. Buffer/Klaviyo acceptance is not delivery evidence. No result is a winner without channel-specific performance evidence.
