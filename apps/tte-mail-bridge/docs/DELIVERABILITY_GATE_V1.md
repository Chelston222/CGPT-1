# Deliverability Gate v1.0

Effective 4 October 2026.

This control is a fail-closed pre-send layer for every external email that passes through `tte-mail-bridge`.

## Required gate snapshot

Every external queue payload must carry an `emailGate` object:

```json
{
  "profile": "COLD_B2B",
  "gateRef": "DELIV-...",
  "addressGate": "PASS",
  "senderGate": "PASS",
  "finalPermission": "EMAIL ALLOWED",
  "verifiedAt": "2026-10-04T13:00:00Z",
  "authorityEvidence": "Concise source/evidence reference",
  "evidenceScore": 95
}
```

Supported external profiles:
- `COLD_B2B`
- `WARM_REQUESTED`
- `APPOINTMENT`
- `CLIENT_LIFECYCLE`

`INTERNAL_OPERATIONAL` is allowed only for controlled internal traffic and requires `finalPermission = INTERNAL ONLY`.

## Freshness

Gate snapshots are revalidated at queue creation, approval and final dispatch.

Default maximum snapshot age:
- COLD_B2B: 72 hours
- WARM_REQUESTED: 60 minutes
- APPOINTMENT: 30 minutes
- CLIENT_LIFECYCLE: 60 minutes

COLD_B2B additionally requires `evidenceScore >= 90`.

## Hard failures

External delivery is blocked when any of these are missing or not PASS:
- gate profile
- gate reference
- authority evidence
- gate timestamp
- address gate
- sender gate
- final permission

The bridge does not infer a missing gate from a public email, prior send, human approval, provider connection or sender capacity.

## Anti-circumvention

A recipient, sender or cohort HOLD/BLOCK must not be bypassed by selecting another mailbox or provider. The route must be re-cleared independently or moved to a separately lawful non-email channel.

## Audit

The queue persists the gate snapshot. Queue creation and approval audits include gate profile, gate reference and final permission. Final dispatch re-runs validation, so a stale gate cannot remain READY indefinitely.

The direct PrivateEmail worker has an independent fail-closed copy of the same rules. External direct-SMTP jobs are COLD_B2B only and require:
- addressGate PASS
- senderGate PASS
- finalPermission EMAIL ALLOWED
- evidenceScore >= 90
- gate snapshot <=72 hours old

Internal direct-SMTP controls must use `INTERNAL_OPERATIONAL` and `INTERNAL ONLY`.

## Deployment

This gate should be reviewed and tested on a branch before production deployment. Do not merge solely because the code compiles. Confirm upstream systems can populate the required gate snapshot without weakening the canonical controls in the 222Emails Module OS.

## P0 Evidence-first acquisition overlay (staged review, not production-released)

Every external `COLD_B2B` queue item and each cold follow-up MUST carry a `preAudit` object in addition to all existing legal, address, suppression, sender, gate-reference, opt-out and approval requirements. Queue intake, human approval and final provider dispatch repeat the same checks. The direct PrivateEmail SMTP worker performs the check independently. `WARM_REQUESTED`, `APPOINTMENT`, `CLIENT_LIFECYCLE` and `INTERNAL_OPERATIONAL` retain their distinct permissions and are not forced into a fake cold prospect audit.

Minimum `preAudit` fields:
- `auditId`, `leadId`, `touchNo`, exact `recipient`
- `evidenceType: "OBSERVED"`, `observedFinding`, `sourceUrl`, `checkedAt`
- `commercialRisk` as a clearly qualified hypothesis, plus one `recommendedFix`
- `observationAnchor` and `fixAnchor`: substantive text present both in the audited finding/fix and in the FINAL actual email body
- `reviewedBy`, `reviewedAt`, `humanReviewPass: true`, `proofAttributionReviewPass: true`
- `approvedMessageSha256`: lowercase SHA-256 over exact UTF-8 `subject + "\n" + text`, produced **after** genuine human content approval

Validation rejects absent or mismatched prospect/touch/recipient identity; no source URL; finding not classified OBSERVED; observations over 30 days old; human review over 72 hours old; missing observation or fix in the body; changed approved subject/body; missing human proof review; or £15k→£25k case wording without the fixed **four-month** timeframe. A casual source or generic introductory question cannot substitute for a reviewable observed problem and useful improvement.

**Honest assurance boundary:** A boolean or reviewer label does NOT prove someone actually checked the public website, audited the clinic or approved the message. That truth must come from a real operating review and source record. This code only enforces the presence, freshness, matching and copy integrity of that record. Existing PECR/UK GDPR, provider, sender, suppression and owner-release gates remain separate.

**Deployment status:** This overlay is initially a review-branch change only, with no live send authority. The existing production deploy remains manual, the direct SMTP runner is held at zero ramp and no mailboxes or senders are enabled merely by these changes. Integrations outside this bridge (manual Gmail/UI, LinkedIn, WhatsApp, external automations) need their own validated pre-send wiring.
