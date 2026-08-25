# Retention School release: triple verification checklist

A release is GREEN only when all three independent layers pass.

## V1 — Source identity
- Exact owner-approved binary is available.
- No recreation, redraw, substitution or enhancement after approval.
- Approval record contains exact byte count and SHA-256.
- Staged asset byte count and SHA-256 match exactly.

## V2 — Pipeline integrity
- Current locked queue revision matches owner approval exactly.
- Content QA PASS.
- Safe-zone QA PASS for the exact binary.
- Media preflight passes type, size, HTTPS, byte count and SHA-256.
- Cadence/capacity/idempotency guards pass.
- No rejected/retired media URL is referenced.

## V3 — Live publication verification
- Buffer acceptance recorded separately from publication.
- Buffer state reaches sent.
- LinkedIn external destination is returned.
- Human visual spot-check confirms the live creative is the exact approved creative.

Any mismatch at V1 or V2 is a hard stop. V3 cannot retroactively excuse a V1/V2 failure.
