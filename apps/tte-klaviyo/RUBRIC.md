# 222 Emails Klaviyo APEX Rubric

Last audited: 12 August 2026

This rubric separates **build quality** from **end-to-end launch readiness**. A strong template or passing API test is not enough to call the revenue engine production-ready.

## Hard gates

Any one of these remaining unresolved blocks production, regardless of weighted score:

- Canonical pre-live flow is not Draft before QA.
- V3 source QA fails.
- Live-API flow verification fails.
- Public capture path into the intended list is unverified.
- Fit Check / client exit logic is unverified.
- Sending-domain authentication health is unverified.
- Desktop/mobile/dark-mode visual QA is unverified.
- Seed inbox, link and reply QA is unverified.
- Fit Check end-to-end submission is unverified.
- Explicit human go-live approval is absent.

## Weighted score

| Dimension | Weight | Current | Evidence / gap |
|---|---:|---:|---|
| Commercial logic | 15 | 15 | Relationship -> Problem -> Method -> Proof -> Conversion is coherent and aligned to Fit Check routing. |
| Offer and copy | 15 | 14.5 | Outcome-led, low-friction next step, no fabricated results; real inbox response still needs observation. |
| Lifecycle logic | 15 | 11 | Trigger, delays and Smart Sending policy are correct; Fit Check/client exit filter is not yet wired. |
| Brand and accessibility | 15 | 14 | V3 palette and real V3 logo are deployed; static QA passes; real client rendering/dark mode remains human QA. |
| Deliverability and compliance | 10 | 6 | Double opt-in, unsubscribe and sender/reply-to exist; sending-domain health and seed inbox placement remain unverified. |
| Infrastructure and safety | 10 | 10 | Versioned source, APEX source gate, live-API verifier, manual activation, canary and emergency-stop controls exist. |
| Capture and conversion continuity | 10 | 4 | Fit Check endpoint exists; no verified public email capture surface currently feeds `SjerhA`; Fit Check-to-Klaviyo bridge is missing. |
| Measurement and attribution | 10 | 4 | Email CTAs have UTMs; custom Fit Check / opportunity / client events are not yet wired into Klaviyo. |
| **TOTAL END-TO-END READINESS** | **100** | **78.5** | **Not production-ready yet because hard gates remain.** |

## Separate build-quality score

The APEX V2 source + account implementation scores **97/100** before human rendering/inbox tests. Static source QA and live Klaviyo API verification both pass against the APEX V2 candidate.

The gap between 97/100 build quality and 78.5/100 end-to-end readiness is intentional. It represents external system continuity and real-world evidence, not unfinished copy/design work.

## APEX acceptance target

Production target is:

- **>= 95/100 end-to-end readiness**, and
- **zero unresolved hard gates**, and
- a controlled manual canary before automatic Live status.

## Current highest-leverage gaps, in order

1. Wire a real permissioned capture route into `Email List` (`SjerhA`).
2. Create a reliable `TTE Fit Check Submitted` Klaviyo event and use it as an exit/suppression condition.
3. Add an explicit client/qualified-opportunity exit condition so sales nurture stops when the relationship changes.
4. Verify sending-domain status/authentication.
5. Run desktop/mobile/dark-mode and real seed-inbox QA.
6. Test the Jotform Fit Check end to end and confirm the Klaviyo event bridge.
7. Run Manual canary, observe, then approve Live.
