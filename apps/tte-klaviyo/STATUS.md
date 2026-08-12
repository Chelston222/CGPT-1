# 222 Emails Klaviyo Flagship Welcome System - APEX Status

Last updated: 12 August 2026

## Executive status

- **Current production candidate:** `VbBAhU`
- **Name:** `TTE Flagship Welcome Series | APEX V2 | PRE-LIVE`
- **Status:** `draft`
- **APEX V2 source + account build quality:** **97/100**
- **End-to-end launch readiness:** **78.5/100**
- **Production status:** **BLOCKED until every hard gate in `RUBRIC.md` passes**

The former flow `TWM6Yx` is now a **legacy proof-build candidate only**. It must not be activated. It uses older creative and does not satisfy the strengthened Smart Sending and launch rubric.

## What is now complete

- Five-email commercial architecture: Relationship -> Problem -> Method -> Proof -> Conversion.
- Main trigger list: `Email List` (`SjerhA`).
- Consent mode: `double_opt_in`.
- Sender/reply-to: `hello@222emails.com`.
- Real Follow-Up Fit Check destination: `https://form.jotform.com/262067771632056`.
- V3 source brand lock using navy `#06173D`, orange `#FF6600`, warm cream `#F7F3EC`, light grey `#F5F5F5`, charcoal `#222222`.
- Real V3 logo is hosted inside Klaviyo Images and referenced by the designed emails.
- E01 deliberately remains founder/plain-style with no image dependency.
- E02-E05 have been rebuilt in V3 branding with no legacy teal/fake `TTE` wordmark.
- All five APEX V2 reusable templates are deployed with HTML + plaintext counterparts.
- All designed-email Fit Check links include Klaviyo UTMs.
- APEX V2 static source QA passes.
- APEX V2 live Klaviyo API verification passes.
- APEX V2 flow has five Draft sends and delays of 1 / 2 / 2 / 2 days.
- Smart Sending policy is now E01 OFF, E02-E05 ON.
- Manual activation gating, manual-canary control and emergency-stop control are implemented in source.
- Template deployment is idempotent for APEX V2 exact names.
- Flow creation refuses exact-name duplicates and dynamically resolves exact APEX V2 template names.

## APEX V2 reusable template IDs

- E01 `WbpUu5`
- E02 `YwdAfM`
- E03 `XTcxDa`
- E04 `U96fVq`
- E05 `R6ChbF`

Klaviyo clones attached templates into flow-message templates. The live-API verifier checks the actual cloned content rather than trusting reusable source IDs.

## Automated verification result

`verify_apex_v2_flow.py` currently PASSes against `VbBAhU`, including:

- exact flow ID/name and Draft status,
- intended trigger list,
- five send actions,
- four delays and exact 1/2/2/2 sequence,
- exact five approved subject lines,
- all five messages Draft,
- Smart Sending `[false, true, true, true, true]`,
- exact sender, from-label and reply-to,
- expected copy markers,
- unsubscribe presence,
- no dead `href="#"`,
- no unresolved deployment placeholders,
- plaintext present in all five,
- no legacy teal,
- exact Klaviyo-hosted V3 logo in E02-E05,
- V3 navy/orange in designed emails,
- live Fit Check destination and Klaviyo UTM on E02-E05.

## Hard production blockers still open

1. **Public capture path**
   - There are currently zero Klaviyo forms in the account.
   - A real permissioned acquisition surface must be verified to feed `Email List` (`SjerhA`).

2. **Fit Check / client exit logic**
   - `VbBAhU` currently has no verified profile filter that stops sales-oriented messages after a Fit Check submission or client conversion.
   - Production stays blocked until a reliable event/property bridge exists and the flow filter is verified.

3. **Measurement / attribution bridge**
   - UTMs exist, but `TTE Fit Check Submitted`, qualified-opportunity and client outcomes are not yet represented by verified Klaviyo custom events.

4. **Sending-domain health**
   - The current private key successfully reads images, forms, profiles and metrics.
   - A first read-only Sending Domains API probe returned a revision/path compatibility 404 rather than a domain-health result. This is not treated as a PASS.
   - Domain health still requires either a working API probe under Klaviyo's current endpoint contract or human UI verification.

5. **Human rendering / inbox QA**
   - Desktop, mobile and dark-mode rendering is unverified.
   - Real seed inbox placement, links and reply behaviour are unverified.

6. **Fit Check end-to-end behaviour**
   - Jotform form `262067771632056` is enabled, but form submission -> intended operational destination -> Klaviyo event has not been verified end to end.

## Safety state

No APEX V2 message is Live. No production subscriber has been sent the APEX V2 flow. Do not activate the legacy `TWM6Yx` flow. Do not activate `VbBAhU` until the hard blockers above are closed and the APEX rubric reaches at least 95/100 with zero hard-gate failures.

## Next build order

1. Capture route.
2. Fit Check event bridge + flow exit.
3. Client / qualified-opportunity exit.
4. Sending-domain verification.
5. Rendering + seed QA.
6. End-to-end Fit Check test.
7. Manual canary.
8. Live approval.
