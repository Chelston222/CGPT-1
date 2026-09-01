# 222Emails Flagship Klaviyo Client Return System

Status: **HARDENING / NOT LIVE**  
Owner: 222Emails  
Canonical candidate flow: `TWM6Yx`  
Purpose: operate as a permission-based nurture and conversion system while demonstrating how 222Emails thinks about Client Return Systems.

## Canonical account configuration
- Trigger list: `Email List` (`SjerhA`)
- Consent: `double_opt_in`
- Sender/reply-to: `hello@222emails.com`
- From label: `222Emails`
- Conversion destination: Free Revenue Recovery Check
- Current route: `https://tally.so/r/44057b`
- Flow status: Draft until automated and human launch gates pass

## Welcome journey
1. E01 Day 0: `Welcome to 222Emails` | relationship / expectations
2. E02 Day 1: `You already paid to acquire them` | belief shift / economics
3. E03 Day 3: `The appointment cliff` | diagnosis
4. E04 Day 5: `What a Client Return System actually does` | mechanism
5. E05 Day 7: `Where are your bookings slipping away?` | Free Revenue Recovery Check conversion

The sequence intentionally does not place a hard commercial CTA in every message. Each email gets one central job and the reader earns the next step progressively.

## Email Revenue OS hard gates
Current-facing source must use `222Emails`, the Client Return System category and current Tally routes. Current public Jotform routes, spaced `222 Emails`, em dashes, fabricated proof or scarcity, competing primary CTAs and superseded formal system naming fail source QA.

## Production blockers
These are not cosmetic. Production stays blocked until verified:
1. Exact V3 brand assets/rendering for designed emails.
2. Public double-opt-in capture path.
3. Revenue Recovery Check event bridge and client/qualified-opportunity exit logic.
4. Desktop/mobile/dark-mode rendering and seed-inbox QA.
5. SPF, DKIM and DMARC readiness/alignment.
6. Gmail/Yahoo-compatible one-click unsubscribe mechanism for promotional messages, plus visible unsubscribe content.
7. End-to-end Free Revenue Recovery Check routing and attribution.
8. Explicit typed go-live approval.

## Deployment architecture
`Email Revenue OS -> GitHub source -> source QA -> Klaviyo API -> Draft -> live-account QA -> human QA -> canary -> Live`

`deploy_templates.py` is idempotent and only creates/updates reusable templates. `create_welcome_flow.py` creates draft send actions only. Neither operation authorises a live send.

## Source of truth
- Strategy/operating model: `ENGINE.md`
- Email system contract: `context/222Emails Email Revenue OS v1.0 2026-08-31.json`
- Templates: `templates/`
- Static QA: `source_audit.py`
- Live-account verifier: `verify_flagship_flow.py`
- Launch gate: `launch_readiness.py`

## Governance
No real send without final QA. A configured flow is not a working flow and a working flow is not permission to scale volume. Build, validation, launch and scaling remain separate decisions.
