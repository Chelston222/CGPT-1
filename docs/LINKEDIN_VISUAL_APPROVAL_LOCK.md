# LinkedIn Visual Approval Lock

## Purpose
Prevent a technically valid but visually incorrect asset from reaching Buffer.

## Rules
1. Never recreate or substitute an approved creative for publishing.
2. The exact asset shown to and approved by the owner must be the asset staged for Buffer.
3. Image posts require an immutable media fingerprint before release: byte count and SHA-256.
4. SAFE_ZONE_QA is not visual approval. It only confirms crop/safe-zone suitability.
5. A post with media must remain fail-closed if the approved asset is missing, changed, regenerated, or replaced.
6. Temporary render workflows must never be treated as approval sources.
7. If an owner deletes a published post because the creative is wrong, retire the associated replenishment entry and media path before any retry.

## Retention School incident, 25 Aug 2026
The launch copy was correct, but a newly recreated SVG/PNG was used instead of the approved Retention School creative. The published post was deleted by the owner. The incorrect source/render were removed from the repository and the launch replenishment was retired. Future Retention School publishing must use the exact approved asset only.
