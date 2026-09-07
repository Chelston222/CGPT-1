# 222Emails LinkedIn review, approval and Buffer scheduling

## Purpose

This document describes the governed release layer between the 222Emails LinkedIn review queue and Buffer. The canonical PDF operator contract is `docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md`.

A saved review decision is not publication authority. Only an eligible repository-owner approval can enter the Buffer release path. Governed PDF/document posts additionally require the canonical exact-media IMAP intake. Live Notion checking is an additional defence when the GitHub Notion credential is configured.

## Authority states

Keep these states separate:

1. reviewed
2. exact media verified
3. owner approved
4. accepted/scheduled by Buffer
5. publication verified

A Buffer post ID is provider acceptance evidence. It is not LinkedIn publication proof.

## Live components

- review UI: `apps/linkedin-review/`
- governed queue: `apps/linkedin-review/queue.json`
- release: `.github/workflows/linkedin-buffer-autopost.yml`
- read-only intent recovery: `.github/workflows/linkedin-buffer-intent-reconcile.yml`
- publication/analytics verification: `.github/workflows/linkedin-publication-verifier.yml`
- optional Notion read preflight: `.github/workflows/linkedin-notion-preflight.yml`
- media preflight: `scripts/linkedin-media-preflight.cjs`
- durable ledger helpers: `scripts/linkedin-buffer-acceptance-ledger.cjs`
- live Notion helper: `scripts/linkedin-notion-quality-gate.cjs`
- request builder: `scripts/linkedin-review-core.cjs`
- weekly lock validation: `scripts/linkedin-week-batch.cjs`
- canonical PDF intake: `.github/workflows/linkedin-imap-pdf-intake.yml`

Secrets remain in GitHub Actions secrets only. Do not place API keys or mailbox passwords in issues, repository files or Notion.

## Release lock

All production Buffer releases use:

```text
linkedin-buffer-capacity-release
```

The surviving run drains the full eligible open approval queue under that lock. The read-only intent reconciler shares the same lock, preventing reconciliation and a new provider write from racing each other.

## Credential and authority gate

Production release fails closed without `BUFFER_API_KEY`.

`NOTION_API_KEY` is optional defence-in-depth, not the sole release authority. The minimum authority remains an exact current governed queue revision plus a repository-owner approval whose fingerprint exactly matches that revision.

If `NOTION_API_KEY` exists, live Notion is checked during planning and again before provider mutation. A failing live gate blocks release.

If it does not exist, the release audit explicitly uses:

```text
owner-approved-current-queue-no-notion-secret
```

and must not claim that Notion was live-checked. A change made only in Notion cannot be relied upon to revoke an already matching GitHub approval in this mode. Revoke by withdrawing the approval or changing the governed queue revision.

The standalone Notion preflight reports `SKIPPED_NO_SECRET` rather than failing the repository when the optional credential is absent.

## Queue and approval lock

A single-post approval must exactly match a current `post-id@revision` in the governed queue.

The fingerprint binds:

- ID and revision
- target(s)
- mode and schedule
- caption copy
- media URL and kind
- image alt text when applicable
- document title and thumbnail
- document page count
- media byte count and SHA-256 when supplied

Changed release material requires a new revision and new approval.

## Optional live Notion quality gate

For governed PDF intake rows, the operational Notion record should remain active and release-ready:

- page not archived
- page not in trash
- Content Decision = Keep
- Approval = Approved
- Anti-DNA pass
- exactly one governed target
- exactly one locked target schedule
- Asset Ready
- Automation Ready
- automation-capable status, not Manual
- permitted Buffer state
- Final Copy exactly matches the queue caption
- Publish Payload exactly matches the queue caption
- Scheduled At represents the same instant as the queue schedule

When the GitHub credential exists, the release workflow checks the live Notion row during planning and **again immediately before each dispatch intent and Buffer provider write**. This closes the practical time-of-check/time-of-use gap if the source row is revoked while media or capacity preflight is running.

When the credential is absent, this live layer is skipped explicitly. Exact current-queue fingerprinting and repository-owner approval remain mandatory.

## Media preflight

All approved media selected for dispatch is remotely preflighted before the first Buffer write.

As applicable it verifies:

- HTTPS
- final resolved URL
- HTTP success
- content type
- byte ceiling
- approved bytes
- approved SHA-256
- PDF signature
- page count
- image alt text

Canonical PDF and thumbnail URLs are revision-scoped and pinned to the same immutable Git commit. The intake also publicly re-verifies the PDF bytes/SHA/pages and exact promoted thumbnail bytes/SHA before approval can proceed.

## Capacity

Capacity checks inspect the current scheduled Buffer inventory for configured LinkedIn channels. Duplicate channel IDs are normalised.

If the provider response cannot represent the full inventory within the supported query, capacity fails closed instead of using a partial count.

Existing owner-approved schedules are never silently moved to create capacity.

## Durable dispatch intent and acceptance

Each placement has a stable key:

```text
<post-id>@<revision>:<target>
```

Immediately before Buffer mutation the workflow writes a durable dispatch intent to the trusted ledger and approval issue.

After Buffer returns a post ID, durable acceptance is written to the trusted ledger first and then mirrored onto the approval issue.

Trusted ledger selection allows the repository owner or `github-actions[bot]` as creator. More than one trusted ledger is split-brain state and fails closed.

A durable accepted key is idempotent and is not recreated. An unresolved intent also blocks automatic recreation until provider state is reconciled.

## Read-only intent reconciliation

The owner-gated `.github/workflows/linkedin-buffer-intent-reconcile.yml` is strictly a recovery path for uncertain provider writes.

It never creates, edits or deletes a Buffer post.

It reconstructs the locked placement and searches a bounded time window around its due instant. Recovery can use a provider record in `scheduled`, `sent` or `error` state, which allows an uncertain write to be reconciled even after the scheduled time has passed.

Automatic repair requires exactly one provider post matching:

- destination channel
- exact due instant
- exact caption digest
- exact media asset source URL for media posts, or no media asset for text-only posts

Zero or multiple matches remain blocked.

When exactly one match exists, the reconciler writes the missing durable acceptance evidence. Publication still requires the separate verifier.

## Schedule integrity

- `Europe/London` is the operating timezone.
- scheduled timestamps contain an explicit UTC offset or `Z`
- a live release rejects a due time that is too close or already passed
- existing approved schedules are never silently moved
- changed time requires a new locked revision and owner approval
- canonical IMAP PDF intake additionally limits new schedules to 90 days so they remain inside the current 120-day publication-verifier horizon

## PDF approval shape

```text
POST_ID: <id>
REVISION: <revision>
CATEGORY: <category>
TARGETS: <single target>
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT: <ISO with explicit offset or Z>
MEDIA_URL: https://raw.githubusercontent.com/<owner>/<repo>/<40-character-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/<id>.pdf
MEDIA_KIND: document
DOCUMENT_TITLE: <document title>
DOCUMENT_THUMBNAIL_URL: https://raw.githubusercontent.com/<owner>/<repo>/<40-character-commit>/apps/linkedin-review/media/intake/<id>/r<revision>/thumbnail.jpg
DOCUMENT_PAGE_COUNT: <page count>
MEDIA_BYTES: <exact bytes>
MEDIA_SHA256: <exact SHA-256>
---
<exact final caption>
```

Canonical IMAP PDF intake is single-target. The broader non-PDF review system can still support multi-target releases where its state model is unambiguous.

## Publication verification

Buffer acceptance is not publication proof.

The publication verifier reads exact accepted Buffer IDs. Normally those IDs come from trusted bot evidence on the approval issue. If the durable ledger was written but approval-issue writeback was lost, the verifier can recover the Buffer ID by mapping the trusted dispatch-intent placement key to exactly one governed approval issue.

Only provider state `sent` with `sentAt` becomes publication verified.

Provider `error` becomes failed. A late unresolved state remains pending/UNKNOWN.

Publication verification is read-only toward Buffer.

PDF posts retain a native LinkedIn analytics requirement when Buffer does not expose sufficient document analytics.

## Retired PDF surfaces

`.github/workflows/linkedin-pdf-intake.yml` and `.github/workflows/linkedin-pdf-share-now.yml` are retired compatibility surfaces. They must not provide a parallel PDF reconstruction or immediate publication route.

## Failure classes

The release layer distinguishes at least:

- approval/revision mismatch
- queue fingerprint drift
- optional live Notion quality failure when credentialed
- archived/trashed Notion source when credentialed
- media URL/type/size/byte/hash failure
- Buffer authentication/channel failure
- incomplete capacity inventory
- unresolved dispatch intent
- durable-ledger split-brain state
- Buffer provider-write failure
- durable acceptance write failure
- publication verification failure
- analytics unavailable/native analytics required

Do not recreate an accepted destination simply because another stage failed. Do not count failed, pending or unknown state as published.

## Release rule

A hardened release is green only when relevant CI is passing, queue and media contracts are current, documentation matches implementation, no unexplained unresolved intent remains, and every live claim is supported by provider evidence rather than inference. The audit must always state whether live Notion defence ran or the no-secret owner-approved current-queue fallback was used.
