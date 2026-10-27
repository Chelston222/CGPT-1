# Outreach launch readiness, 27 October 2026

## Decision

Reuse the existing Commercial Command Centre, mail bridge and controlled manual
LinkedIn workflow. No Apollo, paid tool, new sender, new host or prospect factory.
The earlier promise of a fully operational cold-email engine at £0 was not
supported by the current provider terms or release state.

Additional software purchased in this implementation: £0. This is incremental
cost, not a claim that existing subscriptions or staff time are free.

## Verified state

| Component | Evidence | Limit |
| --- | --- | --- |
| Existing CRM | Commercial Command Centre metadata and Sender Controls read on 27 October | Reuse canonical records; do not build a second CRM |
| Mail bridge | Live `/api/tte/health` returned HTTP 200, READY, SMTP and transportConfigured true | Health is not send release or proof of queue state |
| Founder SMTP | Actions run 40446442200 succeeded; independently received in the owned Gmail inbox at 04:14 GMT | Existing test inspected; no extra test or prospect email sent |
| Authentication | Received founder test reports SPF PASS and DKIM PASS, selector default, domain 222emails.com | One observed message, not universal inbox placement |
| DNS | Google public DNS response: one SPF TXT at domain; `_dmarc` returned NXDOMAIN on 27 October | DNS editing requires authenticated Cloudflare access; no record changed |
| Queue inspection | Actions run 40438537044 failed in Verify read-only credential | Existing TTE_BRIDGE_TOKEN is missing from Actions; queue state unknown |
| Runtime workers | Office snapshot says no independent worker runtime, sending draft-only | Office task records do not establish unattended execution |
| Code baseline | 44 tests and TypeScript passed locally | Does not establish production behaviour |
| Zero-cap repair | Regression fails on original delivery engine and passes on patched engine | Prepared code; separate production release required |
| Repaired suite | 65 tests pass, TypeScript passes, production dependency audit finds 0 vulnerabilities | Synthetic engine tests use mocked provider and storage; no real sends |

## Implementation

`delivery-limits.mjs` preserves an explicit zero for global, SMTP daily, SMTP
rolling and recipient-domain caps. Malformed explicit settings fail closed at
zero. Absent settings retain previous defaults. The engine and metrics share the
same interpretation. Previously, minimum-one clamping converted a zero stop into
one permitted message; metrics also reported one. Dispatch switches remain an
independent stop and were not changed.

Integration tests exercise the actual delivery engine with isolated provider and
storage mocks. Each zero-cap path blocks before provider submission and before
an idempotency reservation. These are code-level results, not live campaign tests.

## Remaining critical path, in order

1. **Inspect the existing queue.** The owner adds the SAME existing operator token
   to CGPT-1 Actions as `TTE_BRIDGE_TOKEN`. Do not disclose it in chat or rotate
   production token/encryption values. Run the existing read-only snapshot.
   Inspect READY, IN_FLIGHT and DELIVERY_UNKNOWN before any deployment or release.
   Resolve uncertain deliveries by evidence, never automatic resend.
2. **Publish DMARC through the current DNS provider.** Verify the authoritative
   zone and all legitimate senders first. A monitoring-policy candidate is TXT
   `_dmarc` = `v=DMARC1; p=none`. Add reporting only to an owned, agreed reporting
   address. This candidate is not a deployed record or a complete enforcement
   policy. Preserve SPF and DKIM. Verify the authoritative record and a fresh
   owned-inbox message after the change.
3. **Release the zero-cap correction with delivery paused.** Review the patch,
   pass CI, merge, then use the existing explicit deployment procedure only after
   queue reconciliation. Keep global/direct caps zero and both dispatch switches
   off. Read back metrics and verify that zero is reported accurately.
4. **Prove reply and suppression handling in isolation.** Use synthetic leads in
   non-production state to test reply, opt-out, bounce, complaint, duplicate,
   stale approval and ambiguous-delivery cases. Then verify the real inbound
   event connection and canonical CRM writeback. Current endpoint existence is
   not proof that this connection is installed.
5. **Prepare a small eligible cohort.** Reuse Message Ledger, OUTREACH, Contact
   State, Suppression Master and DNC. Check exact current thread, aliases,
   reservations and source-backed pre-audit. Preserve recipient-specific holds.
   Target 25–50 researched prospects per week as a working capacity assumption,
   not a sending quota. Prioritise genuine warm replies.
6. **Release only the justified channel.** Controlled LinkedIn actions retain
   their current identity, history, review and provider-limit gates. Email on
   Private Email is permission-qualified only, subject to current release.
   No sender switching, automatic cold sequence or new paid provider is approved.

## Provider and UK rules

Namecheap Private Email incorporates the Hosting Terms. The accepted-use terms
prohibit unsolicited commercial or bulk email. Corporate B2B treatment under
PECR does not override a provider contract. Existing Gmail and Private Email
cold caps remain zero. Cold-email acquisition requires a separately selected,
permitted provider route and current release; no price or £0 availability has
been established for that route.

The ICO distinguishes corporate subscribers from sole traders and some
partnerships. UK GDPR still applies where personal data is processed. Never
infer a permitted recipient from a public email address alone.

## Canonical sources

- Command: https://docs.google.com/document/d/1fKwKu5j6rw1kKPxu-PcjGEgbrdSfIK9E2L7c6vNQlH0/edit
- CRM: https://docs.google.com/spreadsheets/d/1J1XwoAIVfC4v8Zcr-D4KEN0Q0ZGfKFfxeXoheDx3nc4/edit
- Founder test: https://github.com/Chelston222/CGPT-1/actions/runs/40446442200
- Queue inspection failure: https://github.com/Chelston222/CGPT-1/actions/runs/40438537044
- Private Email terms: https://www.namecheap.com/legal/hosting/netos/
- Hosting accepted use: https://www.namecheap.com/legal/hosting/tos/
- ICO: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/

Status: implementation and verification progressed; production outreach is not
fully commissioned. No prospect contacted, cap raised, workflow resumed, DNS
record edited, new subscription purchased or production deployment performed
in this work.
