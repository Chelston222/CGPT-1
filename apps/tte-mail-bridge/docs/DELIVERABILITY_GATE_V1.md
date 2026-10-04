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