# Retention School media release lock

Status: CURRENT
Effective: 25 August 2026

For any Retention School / LinkedIn image post, the exact owner-approved binary asset is the release authority.

Hard rules:
1. No SVG redraw, recreation, substitution, enhancement, reinterpretation or generated stand-in may replace an approved image.
2. SAFE_ZONE_QA confirms crop/readability only; it is never approval of asset identity.
3. Before Buffer release, record and compare the exact approved asset byte count and SHA-256 fingerprint.
4. If the staged media does not match the approved fingerprint exactly, fail closed and do not schedule or publish.
5. If the exact approved binary is unavailable, do not guess. Re-acquire that exact source asset before release.
6. Any retired or rejected launch creative must remain excluded from future automatic replenishment.
7. Publication verification proves that something posted, not that the correct creative posted. Asset-identity verification must happen before Buffer acceptance.

Incident note: the 25 August 2026 Retention School launch published a technically valid but visually incorrect substitute creative. The owner deleted it. This document exists to prevent recurrence.
