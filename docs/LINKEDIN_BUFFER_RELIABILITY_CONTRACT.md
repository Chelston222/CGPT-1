# LinkedIn / Buffer Reliability Contract

Status: production guardrail
Owner: 222Emails / Chelston
Timezone: Europe/London

## Objective

Keep the governed LinkedIn Content OS reliable over time by making failure visible, bounded and recoverable without weakening approval or content-quality controls.

The design goal is **zero silent failure**, not the impossible promise that an external platform can never fail.

## Permanent release invariants

Every live scheduled Buffer placement must satisfy all of the following:

1. It belongs to one of the three configured LinkedIn destinations: `personal`, `main` or `secondary`.
2. It maps to a trusted GitHub Actions Buffer acceptance record.
3. That acceptance record maps to an exact locked queue revision in the effective queue.
4. The locked queue revision authorises the exact target.
5. The live Buffer due time exactly matches the locked queue due time.
6. The placement is fixed/custom scheduled so recurring Buffer slot edits cannot silently move it.
7. The governed daily and weekly cadence ceiling is not exceeded.
8. Buffer channel identity, connection state and Europe/London timezone remain valid.
9. Any media placement keeps HTTPS media, exact SHA-256 metadata and a positive byte count in the locked queue record.
10. A duplicate live destination for the same queue revision and target is a hard failure.
11. A scheduled placement more than 15 minutes past due is a hard failure until publication or failure state is reconciled.
12. Buffer pagination must be complete. An incomplete provider view is never treated as healthy.

## Permanent monitoring

### Hourly live sentinel

Workflow: `.github/workflows/linkedin-buffer-reliability-sentinel.yml`

Runs every hour and on relevant production changes. It compares live Buffer state against:

- the effective locked queue
- trusted approval/acceptance history
- the current distribution policy
- live provider channel identity and connection state

It is read-only against Buffer.

If a hard invariant fails it opens or updates one canonical incident:

`[LINKEDIN RELIABILITY INCIDENT] Content OS / Buffer`

When the system recovers, the same incident is closed with recovery evidence.

### Daily deterministic regression

Workflow: `.github/workflows/linkedin-content-os-nightly-regression.yml`

Runs every day and on relevant code changes. It executes syntax checks, the LinkedIn regression suite and the full QA-bank audit.

Failures open or update:

`[LINKEDIN RELIABILITY INCIDENT] Regression suite`

Recovery closes the incident with evidence.

### Existing release controls retained

The reliability layer does not replace or weaken:

- Notion/live quality gates where applicable
- locked queue revisions
- exact owner approval issues
- media preflight
- Buffer capacity checks
- accepted-destination idempotency
- publication verification
- analytics maturity rules
- the existing LinkedIn Content OS Green Gate

## Safe self-healing boundary

Automatic behaviour is intentionally limited to operations that cannot change customer-facing content:

Allowed automatically:

- retrying already-approved transient Buffer failures through the existing release loop
- deduplicating already-accepted destinations through acceptance markers
- opening/updating/closing reliability incidents
- re-running deterministic checks
- refreshing read-only health evidence

Not allowed automatically:

- changing copy
- changing media
- changing targets
- changing due times
- deleting or moving live Buffer posts
- manufacturing owner approval
- replacing a failed queue revision with a different one
- bypassing media, QA, cadence or publication gates

A permanent data or content defect must fail closed and return through a new governed revision.

## Recovery priority

1. Preserve already-accepted healthy Buffer placements.
2. Stop duplicate creation.
3. Restore exact queue/approval mapping.
4. Restore provider connectivity and identity.
5. Restore deterministic regression health.
6. Re-run read-only live verification.
7. Only then resume normal releases.

## Operational definition of healthy

The system is healthy when:

- the hourly sentinel is green
- every live Buffer placement is mapped to an exact locked revision
- cadence passes
- provider state passes
- there are no stale scheduled placements
- the recurring regression suite passes
- the existing Content OS Green Gate is green or has only explicitly preserved historical debt

This contract is intended to remain authoritative for future LinkedIn / Buffer hardening unless the distribution architecture itself is deliberately replaced.
