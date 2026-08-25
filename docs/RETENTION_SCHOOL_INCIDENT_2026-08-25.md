# Retention School LinkedIn media incident — 25 Aug 2026

Status: remediating

Observed failure:
- Buffer/LinkedIn successfully published a Retention School launch post using a technically valid but owner-rejected substitute creative.
- The owner deleted the LinkedIn post after visual inspection.

Root cause class:
- Release validation proved media reachability, type, size, hash and safe-zone status, but did not prove that the staged binary was the exact owner-approved creative.
- A generated SVG/PNG stand-in was permitted to become release media.

Permanent controls:
- Exact approved binary identity is now required before release.
- No redraw, recreation, enhancement, substitution or generated stand-in is allowed after owner approval.
- Exact byte count and SHA-256 must be pinned to the approval revision before Buffer release.
- Missing approved binary is a hard fail; no guessing.
- Publication verification remains downstream evidence only and cannot substitute for pre-release asset identity.

Retired incident assets:
- apps/linkedin-review/media/retention-school-launch.svg
- apps/linkedin-review/media/retention-school-launch-4k.png

The owner-rejected launch replenishment record has been retired and must not be auto-reintroduced.
