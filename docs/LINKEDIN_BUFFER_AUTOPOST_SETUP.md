# 222Emails LinkedIn review, approval and Buffer scheduling

## Purpose

This document describes the governed release layer that sits between the 222Emails LinkedIn review queue and Buffer.

A saved review decision is not publication authority. Only an eligible repository-owner approval issue can enter the Buffer release path. PDF/document posts additionally require the canonical exact-media intake route and live Notion quality gate.

Supported destinations:

- Chelston personal LinkedIn profile
- Main 222Emails LinkedIn Page
- 222Emails | Retention Lab

Supported formats:

- text-only posts
- single-image posts
- LinkedIn PDF/document posts

The repository and public review UI do not contain Buffer credentials.

## Live components

- Content Swiper: `apps/linkedin-review/`
- Governed queue: `apps/linkedin-review/queue.json`
- Approval and Buffer release: `.github/workflows/linkedin-buffer-autopost.yml`
- Buffer intent reconciliation: `.github/workflows/linkedin-buffer-intent-reconcile.yml`
- Publication and analytics verification: `.github/workflows/linkedin-publication-verifier.yml`
- Read-only Buffer queue diagnostic: `.github/workflows/buffer-usage-check-once.yml`
- Media integrity preflight: `scripts/linkedin-media-preflight.cjs`
- Durable Buffer acceptance ledger helpers: `scripts/linkedin-buffer-acceptance-ledger.cjs`
- Live Notion quality gate: `scripts/linkedin-notion-quality-gate.cjs`
- Core request and mutation builder: `scripts/linkedin-review-core.cjs`
- Weekly lock and validation: `scripts/linkedin-week-batch.cjs`
- Canonical PDF intake: `.github/workflows/linkedin-imap-pdf-intake.yml`
- Canonical PDF playbook: `docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md`

## Repository secrets

Store production secrets only in GitHub Actions secrets:

- `BUFFER_API_KEY`
- `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID`
- `NOTION_API_KEY`

For the PrivateEmail PDF bridge, the existing mail credential is also required by the intake workflow.

Never place API keys or mailbox passwords in issues, repository files, Notion rows or public review state.

## Authority model

These states must remain separate:

1. reviewed
2. exact media verified
3. owner approved
4. accepted or scheduled by Buffer
5. publication verified

A YES decision in the Content Swiper is review state only. `[PDF INTAKE READY]` is media-readiness evidence only. A Buffer post ID proves provider acceptance only. None of those alone prove LinkedIn publication.

## Release lock

All production Buffer releases share one concurrency group:

```text
linkedin-buffer-capacity-release
```

The surviving run drains the full eligible open approval queue under that lock rather than processing only the triggering issue. The read-only dispatch-intent reconciler uses the same lock so reconciliation and new release cannot race each other.

## Production credential gate

The production release fails closed if `BUFFER_API_KEY` is missing.

For every non-QA governed release, it also fails closed without `NOTION_API_KEY`. The live Notion gate is part of the release contract, not an optional enhancement.

## Current queue lock

A single-post approval is accepted only when it exactly matches a current `post-id@revision` in `apps/linkedin-review/queue.json`.

The approval fingerprint locks release material including:

- post ID and revision
- target or targets
- mode and schedule
- caption copy
- media URL and kind
- image alt text where applicable
- document title and thumbnail
- document page count
- media byte count and SHA-256 where supplied

A stale or issue-only request that no longer matches the current queue fails closed. Changed release material requires a new revision and new owner approval.

## Live Notion quality gate

For normal production rows the release workflow reads the exact Notion source page referenced by the queue and requires the configured content and automation state to remain release-ready.

For governed PDF intake rows the gate additionally binds:

- exactly one governed target
- exactly one locked target schedule
- Asset Ready
- Automation Ready
- Final Copy
- Publish Payload
- Scheduled At

The locked queue caption must exactly match both Final Copy and Publish Payload. The Notion schedule must represent the same instant as the locked queue schedule.

`Automation Status = Manual` may remain legitimate for other governed content, but it does not authorise automated Buffer release for a canonical PDF intake row.

## Media preflight

All approved media selected for a dispatch plan is remotely preflighted before the first Buffer write.

The preflight verifies, as applicable:

- HTTPS transport
- final resolved URL
- HTTP success
- expected content type
- byte ceiling
- approved byte count
- approved SHA-256
- PDF signature
- document page count
- image alt text

For canonical PDF intake, the governed PDF and thumbnail URLs are pinned to the exact immutable Git commit that contains those files before downstream release. The public PDF is rechecked for exact bytes, SHA-256 and page count. The public thumbnail is also checked against the exact promoted thumbnail bytes and SHA-256. The release therefore does not depend on a mutable `main` media ref.

## Buffer capacity

Capacity calculations inspect the current scheduled Buffer inventory for the configured LinkedIn channels. Duplicate channel IDs are normalised before querying.

If the provider returns more scheduled rows than the supported complete query can represent, release fails closed rather than calculating from a partial inventory.

Current daily placement limits and weekly content ceilings remain enforced by the existing capacity policy. Existing owner-approved schedules are never silently moved to make capacity.

## Durable dispatch intent and acceptance ledger

Every governed placement has a stable placement key derived from queue ID, revision and destination.

Immediately before the Buffer write, the workflow writes a durable dispatch-intent marker to the machine ledger and the approval issue. This records that a provider write may have occurred even if the workflow crashes before receiving or persisting the response.

The ledger issue may be created by GitHub Actions, so trusted ledger discovery accepts the repository owner or `github-actions[bot]` as the ledger creator. More than one trusted ledger is treated as split-brain state and fails closed.

When Buffer returns a post ID, the workflow immediately writes a durable acceptance record containing the placement identity, Buffer post ID, due time and available media proof.

Accepted placement keys are treated as idempotent across later approval runs. They are not blindly recreated because another destination failed or a later workflow run started.

An unresolved intent is more conservative: automatic recreation of that placement is blocked until the provider state is reconciled.

## Read-only intent reconciliation

The owner-gated workflow `.github/workflows/linkedin-buffer-intent-reconcile.yml` exists only for unresolved dispatch intents.

It performs Buffer reads, not Buffer creates, edits or deletes.

For each unresolved placement it reconstructs the locked release identity and searches the scheduled Buffer inventory. Automatic repair is allowed only when exactly one provider record matches:

- destination channel
- exact due time
- exact caption digest
- exact media source URL for media posts, or no media asset for text-only posts

The media comparison uses Buffer's returned asset `source`, so an unrelated post with the same time and caption cannot be adopted merely because its text matches.

When exactly one full match exists, the reconciler writes the missing durable acceptance record. When zero or multiple matches exist, the placement stays blocked for explicit review.

This boundary prevents a retry from manufacturing a duplicate when the original provider write may already have succeeded.

## Approval examples

### Text-only

```text
POST_ID: tte-li-013
REVISION: 1
CATEGORY: buyer_diagnostics
TARGETS: personal,main
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT_PERSONAL: 2026-09-10T15:00:00+01:00
SCHEDULE_AT_MAIN: 2026-09-10T20:00:00+01:00
---
Fallback copy
---PERSONAL---
Founder-led version
---MAIN---
Company-page version
```

### Single-image additions

```text
CONTENT_QA: PASS
SAFE_ZONE_QA: PASS
MEDIA_URL: https://example.com/visual.png
MEDIA_KIND: image
ALT_TEXT: Clear description of the visual and its useful meaning
MEDIA_BYTES: 845221
MEDIA_SHA256: <64-character SHA-256 when the media is locked>
```

### PDF/document additions

```text
CONTENT_QA: PASS
MEDIA_URL: https://raw.githubusercontent.com/<owner>/<repo>/<40-character-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/<id>.pdf
MEDIA_KIND: document
DOCUMENT_TITLE: Five places repeat revenue quietly leaks
DOCUMENT_THUMBNAIL_URL: https://raw.githubusercontent.com/<owner>/<repo>/<40-character-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/thumbnail.jpg
DOCUMENT_PAGE_COUNT: 10
MEDIA_BYTES: 5187344
MEDIA_SHA256: <64-character SHA-256>
```

Canonical IMAP PDF intake itself is single-target. The wider review system still supports explicit multi-target release for other content where the queue and quality model provide unambiguous per-destination state.

## Schedule integrity

- `Europe/London` is the operating timezone.
- Scheduled timestamps must contain an explicit UTC offset or `Z`.
- The live release path rejects a due time that is too close to dispatch or has already passed.
- Existing owner-approved schedules must never be silently moved.
- A schedule change requires a new locked revision and new approval.
- New unapproved inventory follows the current testing policy in `docs/LINKEDIN_CONTENT_STRATEGY_2026.md`.
- Drafts do not consume scheduled publishing capacity until they are explicitly scheduled.

## Publication verification

Buffer acceptance is not publication proof.

After the due time, `.github/workflows/linkedin-publication-verifier.yml` reads the exact Buffer post ID. Only positive provider state `sent` with a sent timestamp becomes verified publication. Provider `error` becomes failed. A late unresolved state stays pending or unknown for review.

The verifier normally discovers accepted Buffer IDs from bot evidence on the approval issue. It also has a durable-ledger fallback. If the ledger acceptance was written but the matching approval-issue acceptance comment was lost after a partial failure, the verifier maps the trusted ledger entry back to the exact approval issue through its pre-write dispatch-intent marker and continues verification from that durable Buffer ID.

Publication verification is read-only toward Buffer.

PDF/document posts retain a native LinkedIn analytics requirement when Buffer does not expose complete document analytics.

## Retired PDF release surfaces

The historical `.github/workflows/linkedin-pdf-intake.yml` and `.github/workflows/linkedin-pdf-share-now.yml` are retired compatibility surfaces. They must not provide a parallel production upload, reconstruction or immediate-publication route.

For LinkedIn PDF/document publishing, use the canonical IMAP exact-media path documented in `docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md`.

## Failure classes

The system should distinguish at least:

- approval and revision mismatch
- queue fingerprint drift
- live Notion quality failure
- media URL, type, size, byte or hash failure
- Buffer authentication or channel access failure
- incomplete Buffer capacity inventory
- unresolved prior dispatch intent
- durable-ledger split-brain state
- Buffer write failure
- acceptance-ledger write failure
- publication verification failure
- analytics unavailable or native analytics required

A successful destination is never recreated simply because another destination failed later. A failed or unknown publication must never be counted as published.

## Release rule

Do not call the release layer complete merely because code exists. A hardened release is only green when the relevant CI suites pass, the current queue and media contracts remain valid, documentation matches implementation, no unexplained unresolved Buffer intent remains, and any live activation claim is supported by provider evidence rather than inference.
