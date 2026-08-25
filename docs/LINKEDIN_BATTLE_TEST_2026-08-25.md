# LinkedIn Battle Test — 25 Aug 2026

Status: remediation in progress.

Confirmed incident: a technically valid but visually incorrect Retention School creative was published. Owner deleted the post.

Immediate remediation completed:
- Removed the incorrect Retention School SVG and 4K PNG from the repository.
- Retired the launch replenishment source so it contains zero publishable posts.
- Retired the launch render workflow so it cannot regenerate a substitute creative.
- Added a visual approval lock policy distinguishing SAFE_ZONE_QA from exact owner approval.
- Added regression tests for stale-asset removal and retired-render behaviour.

Battle-test findings from automated suites:
- LinkedIn Content OS self-test exposed a malformed Retention School replenishment schema. Fixed by retiring the source with schemaVersion 1.
- Hardening suite exposed stale expectations around QA replenishment counts and draft-canary verifier wording. The replenishment-count failure should be eliminated by retiring the extra launch source; verifier wording remains a separate test debt item until patched and re-run.

Publishing rule from this incident forward: never recreate, redraw, substitute, or regenerate an approved creative. Stage the exact owner-approved asset and lock its byte count and SHA-256 before Buffer release.
