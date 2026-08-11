# 222 Emails Revenue Template OS Operator Runbook

## Canonical production path

There is one supported route for client email production:

1. Create a client intake JSON from `client_intake.example.json`.
2. Supply only verified client facts, URLs, assets, products, offers and evidence.
3. Run `build_client_pack.py`.
4. Review `creative.json`, `email.html` and `qa.json`.
5. If deploying to Klaviyo, use the manual `TTE Client Draft Build + Deploy` workflow and exact confirmation `DEPLOY-CLIENT-DRAFT-ONLY`.
6. Review the resulting GitHub Actions artifact and Klaviyo draft.
7. Perform real inbox/render testing, link checking, audience/suppression review and flow-logic review.
8. Obtain explicit go-live approval through the existing Klaviyo production controls.

Do not bypass this route by pasting generated HTML directly into a live flow.

## Intake rules

Required areas:
- client identity and business model
- one primary lifecycle goal
- approved brand identity and HTTPS URLs
- real image assets
- customer outcome and problem
- real CTA destination
- product/order facts when the selected journey needs them
- tracking parameters
- evidence object, even when empty

## Evidence policy

Testimonials, proof, guarantees and urgency are optional. They are never inferred.

They are included only when the source intake explicitly marks the evidence `verified: true` and provides the required factual content. Unverified evidence is omitted.

## Build outputs

Every pack contains:
- `intake.json` source facts
- `manifest.json` deterministic build contract
- `creative.json` subject lines, preheaders and recommendation rationale
- `email.html` materialised client HTML
- `qa.json` hard-gate result plus SHA-256 hashes
- `README.md` pack summary
- after live draft deployment, `klaviyo-draft-receipt.json`

## Hard stops

Do not deploy when any of these are true:
- QA status is not PASS
- placeholder imagery remains
- build tokens remain unresolved
- required HTTPS links are missing
- sensitive persuasion evidence is unverified
- unsubscribe/manage-preferences support is missing
- CTA tracking is missing
- current client assets or pricing are uncertain
- legal/compliance language is being guessed

## Real-world gates that cannot be automated away

Before a live send, a human must still confirm:
- Gmail, Apple Mail/iOS Mail and Outlook rendering on the actual final content
- images-off and dark-mode behaviour
- all links and forms work in the client environment
- sending-domain/authentication health
- audience, exclusions, consent, suppression and frequency logic
- dynamic event/catalog data renders using real integration data
- claims, prices, stock, guarantees and deadlines remain true at send time
- the correct flow/campaign is being activated
- explicit approval to go live

## Rollback

Client draft deployment is idempotent by exact generated name. Rebuild from the previous intake/manifest and redeploy to restore the earlier content. Do not delete prior audit packs needed for provenance.

## Maintenance

When changing templates, variants, modules, intake logic or deployment code, `run_final_qa.py` and all GitHub CI gates must pass before merge. Update `SOURCE_LEDGER.md` whenever a new third-party implementation source is incorporated.
